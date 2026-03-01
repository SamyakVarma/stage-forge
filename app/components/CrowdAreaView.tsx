"use client";
import React, { useState, useRef, useEffect, useCallback } from "react";
import { useScene } from "../context/SceneContext";

// Constants
const CELL = 8; // px per sim cell
const PIXELS_PER_METER = 20; // 1 meter = 20 pixels

// Types
type Point = { x: number; y: number };
type PolyType = "venue" | "stage" | "seating" | "standing";
type Polygon = { type: PolyType; points: Point[]; closed: boolean };
type DoorType = "door-gen" | "door-vip" | "exit";
type Door = {
    id: string;
    x: number;
    y: number;
    type: DoorType;
    openMin: number;
    closeMin: number;
    rate: number;
    spawnAccum: number;
};

type AgentState = "moving" | "standing" | "seated" | "exiting";
interface Agent {
    id: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    headingX: number;
    headingY: number;
    isVip: boolean;
    state: AgentState;
    targetSeat: Seat | null;
    patience: number;
    gone: boolean;
    speed: number;
    deviationTrait: number;
}

interface Seat {
    cx: number;
    cy: number;
    occupied: boolean;
    occupantId: number | null;
}

export default function CrowdAreaView() {
    const { scene } = useScene();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [currentTool, setCurrentTool] = useState<PolyType | DoorType | "delete" | "measure">("venue");

    // Sim State
    const [polygons, setPolygons] = useState<Polygon[]>([]);
    const [currentPoly, setCurrentPoly] = useState<Polygon | null>(null);
    const [doors, setDoors] = useState<Door[]>([]);
    const [agents, setAgents] = useState<Agent[]>([]);
    const [simRunning, setSimRunning] = useState(false);
    const [simPaused, setSimPaused] = useState(false);
    const [simTime, setSimTime] = useState(0);
    const [mousePos, setMousePos] = useState<Point>({ x: 0, y: 0 });
    const [hoveredMeasurement, setHoveredMeasurement] = useState<string | null>(null);

    // Grid refs to avoid React re-render overhead on every frame
    const gridsRef = useRef<{
        COLS: number;
        ROWS: number;
        venueGrid: Uint8Array;
        zoneGrid: Uint8Array; // 0=open, 1=stage, 2=seating, 3=standing
        potential: Float32Array;
        basePotential: Float32Array;
        pheromone: Float32Array;
        zoneIdGrid: Uint8Array;
        movDens: Float32Array;
        seats: Seat[];
        stageCX: number;
        stageCY: number;
    }>({
        COLS: 0, ROWS: 0,
        venueGrid: new Uint8Array(0),
        zoneGrid: new Uint8Array(0),
        potential: new Float32Array(0),
        basePotential: new Float32Array(0),
        pheromone: new Float32Array(0),
        zoneIdGrid: new Uint8Array(0),
        movDens: new Float32Array(0),
        seats: [],
        stageCX: 0, stageCY: 0
    });

    const [stats, setStats] = useState({
        total: 0,
        seated: 0,
        standing: 0,
        moving: 0,
        exited: 0,
        peak: 0
    });

    // Params
    const [maxAgents, setMaxAgents] = useState(800);
    const [vipCount, setVipCount] = useState(40);
    const [density, setDensity] = useState(4);
    const [speedMult, setSpeedMult] = useState(1);

    // --- Math Utils ---

    const ptInPoly = (px: number, py: number, pts: Point[]) => {
        let inside = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
            const xi = pts[i].x, yi = pts[i].y;
            const xj = pts[j].x, yj = pts[j].y;
            if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) inside = !inside;
        }
        return inside;
    };

    const inBounds = (cx: number, cy: number) => {
        const { COLS, ROWS } = gridsRef.current;
        return cx >= 0 && cy >= 0 && cx < COLS && cy < ROWS;
    };

    // --- Grid Logic ---

    const rebuildGrids = useCallback(() => {
        const { COLS, ROWS, venueGrid, zoneGrid, potential, basePotential, zoneIdGrid } = gridsRef.current;
        if (COLS === 0) return;

        venueGrid.fill(0);
        zoneGrid.fill(0);
        potential.fill(0);
        basePotential.fill(0);
        zoneIdGrid.fill(0);

        const venuePoly = polygons.find(p => p.type === "venue" && p.closed);
        if (!venuePoly) return;

        // Mark venue
        for (let cy = 0; cy < ROWS; cy++) {
            for (let cx = 0; cx < COLS; cx++) {
                const x = cx * CELL + CELL / 2;
                const y = cy * CELL + CELL / 2;
                if (ptInPoly(x, y, venuePoly.points)) venueGrid[cy * COLS + cx] = 1;
            }
        }

        // Zones
        const stageCells: number[] = [];
        polygons.forEach((poly, pi) => {
            if (!poly.closed || poly.type === "venue") return;
            for (let cy = 0; cy < ROWS; cy++) {
                for (let cx = 0; cx < COLS; cx++) {
                    const i = cy * COLS + cx;
                    if (!venueGrid[i]) continue;
                    const x = cx * CELL + CELL / 2;
                    const y = cy * CELL + CELL / 2;
                    if (!ptInPoly(x, y, poly.points)) continue;

                    if (poly.type === "stage") {
                        zoneGrid[i] = 1;
                        stageCells.push(i);
                    } else if (poly.type === "seating") {
                        zoneGrid[i] = 2;
                        zoneIdGrid[i] = pi + 1;
                    } else if (poly.type === "standing") {
                        zoneGrid[i] = 3;
                        zoneIdGrid[i] = pi + 1;
                    }
                }
            }
        });

        // Potential Field (Distance-based)
        const dist = new Int32Array(COLS * ROWS).fill(-1);
        const queue: number[] = [];
        stageCells.forEach(i => { dist[i] = 0; queue.push(i); });

        if (queue.length === 0) {
            // Default stage top
            const ci = Math.floor(ROWS / 4) * COLS + Math.floor(COLS / 2);
            dist[ci] = 0; queue.push(ci);
        }

        let head = 0;
        while (head < queue.length) {
            const i = queue[head++];
            const cx = i % COLS, cy = Math.floor(i / COLS);
            for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) {
                const nx = cx + dx, ny = cy + dy;
                if (!inBounds(nx, ny)) continue;
                const ni = ny * COLS + nx;
                if (dist[ni] >= 0 || !venueGrid[ni] || zoneGrid[ni] === 1) continue;
                dist[ni] = dist[i] + 1;
                queue.push(ni);
            }
        }

        const falloff = 0.97;
        for (let i = 0; i < COLS * ROWS; i++) {
            if (dist[i] < 0 || !venueGrid[i] || zoneGrid[i] === 1) continue;
            basePotential[i] = Math.pow(falloff, dist[i]);
            potential[i] = basePotential[i];
        }

        // Seats
        const newSeats: Seat[] = [];
        for (let cy = 0; cy < ROWS; cy++) {
            for (let cx = 0; cx < COLS; cx++) {
                if (zoneGrid[cy * COLS + cx] === 2 && cx % 2 === 0 && cy % 2 === 0) {
                    newSeats.push({ cx, cy, occupied: false, occupantId: null });
                }
            }
        }
        gridsRef.current.seats = newSeats;
    }, [polygons]);

    // --- Drawing / Event Handlers ---

    const handleCanvasClick = (e: React.MouseEvent) => {
        const rect = canvasRef.current!.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (currentTool === "delete") {
            // Delete doors
            const doorIndex = doors.findIndex(d => Math.hypot(d.x - x, d.y - y) < 15);
            if (doorIndex >= 0) {
                setDoors(prev => prev.filter((_, i) => i !== doorIndex));
                return;
            }
            // Delete polygons
            const polyIndex = polygons.findLastIndex(p => ptInPoly(x, y, p.points));
            if (polyIndex >= 0) {
                setPolygons(prev => prev.filter((_, i) => i !== polyIndex));
            }
            return;
        }

        if (["door-gen", "door-vip", "exit"].includes(currentTool)) {
            const newDoor: Door = {
                id: `door-${Date.now()}`,
                x, y,
                type: currentTool as DoorType,
                openMin: 0,
                closeMin: 120,
                rate: currentTool === "door-vip" ? 2 : 20,
                spawnAccum: 0
            };
            setDoors(prev => [...prev, newDoor]);
            return;
        }

        if (["venue", "stage", "seating", "standing"].includes(currentTool)) {
            if (!currentPoly) {
                setCurrentPoly({ type: currentTool as PolyType, points: [{ x, y }], closed: false });
            } else {
                const fp = currentPoly.points[0];
                if (currentPoly.points.length > 2 && Math.hypot(x - fp.x, y - fp.y) < 15) {
                    // Close polygon
                    setPolygons(prev => [...prev, { ...currentPoly, closed: true }]);
                    setCurrentPoly(null);
                } else {
                    setCurrentPoly(prev => ({ ...prev!, points: [...prev!.points, { x, y }] }));
                }
            }
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        const rect = canvasRef.current!.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        setMousePos({ x, y });

        // Calculate measurement
        if (currentPoly && currentPoly.points.length > 0) {
            const lastPoint = currentPoly.points[currentPoly.points.length - 1];
            const distPx = Math.hypot(x - lastPoint.x, y - lastPoint.y);
            const distM = (distPx / PIXELS_PER_METER).toFixed(2);
            setHoveredMeasurement(`${distM}m`);
        } else if (currentTool === "measure" || currentTool === "delete") {
            // Check if near any segment
            let segmentDist: string | null = null;
            for (const p of polygons) {
                for (let i = 0; i < p.points.length; i++) {
                    const p1 = p.points[i];
                    const p2 = p.points[(i + 1) % p.points.length];
                    if (!p.closed && i === p.points.length - 1) break;

                    // Point-segment distance
                    const l2 = (p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2;
                    if (l2 === 0) continue;
                    let t = ((x - p1.x) * (p2.x - p1.x) + (y - p1.y) * (p2.y - p1.y)) / l2;
                    t = Math.max(0, Math.min(1, t));
                    const d = Math.hypot(x - (p1.x + t * (p2.x - p1.x)), y - (p1.y + t * (p2.y - p1.y)));

                    if (d < 10) {
                        const len = (Math.sqrt(l2) / PIXELS_PER_METER).toFixed(2);
                        segmentDist = `${len}m (Edge)`;
                        break;
                    }
                }
                if (segmentDist) break;
            }
            setHoveredMeasurement(segmentDist);
        } else {
            setHoveredMeasurement(null);
        }
    };

    // --- Simulation Logic ---

    const spawnAgent = useCallback((px: number, py: number, isVip: boolean) => {
        const { COLS, ROWS, venueGrid, zoneGrid } = gridsRef.current;
        // Find nearest venue cell
        const dcx = Math.floor(px / CELL), dcy = Math.floor(py / CELL);
        let nx = px, ny = py;

        if (!inBounds(dcx, dcy) || !venueGrid[dcy * COLS + dcx]) {
            // Search spiral for venue cell
            search: for (let r = 0; r < 20; r++) {
                for (let dx = -r; dx <= r; dx++) {
                    for (let dy of [-r, r]) {
                        if (inBounds(dcx + dx, dcy + dy) && venueGrid[(dcy + dy) * COLS + (dcx + dx)]) {
                            nx = (dcx + dx) * CELL + CELL / 2;
                            ny = (dcy + dy) * CELL + CELL / 2;
                            break search;
                        }
                    }
                }
            }
        }

        return {
            id: Math.random(),
            x: nx, y: ny,
            vx: 0, vy: 0,
            headingX: 0, headingY: 1,
            isVip,
            state: "moving" as AgentState,
            targetSeat: null,
            patience: isVip ? 999 : 30 + Math.random() * 60,
            gone: false,
            speed: isVip ? 1.0 + Math.random() * 0.4 : 1.2 + Math.random() * 0.6,
            deviationTrait: Math.random() * 0.15
        };
    }, []);

    const step = useCallback((dt: number) => {
        const { COLS, ROWS, venueGrid, zoneGrid, potential, basePotential, pheromone, movDens, seats } = gridsRef.current;
        if (COLS === 0) return;

        // Arrival
        const fillRatio = agents.length / maxAgents;
        const arrivalMult = Math.pow(1.0 - fillRatio, 2);

        const newAgents = [...agents];
        doors.forEach(door => {
            if (door.type === "exit" || !simRunning || simPaused) return;
            door.spawnAccum += door.rate * arrivalMult * dt;
            while (door.spawnAccum >= 1 && newAgents.length < maxAgents) {
                door.spawnAccum -= 1;
                newAgents.push(spawnAgent(door.x, door.y, door.type === "door-vip"));
            }
        });

        // Decay pheromone
        for (let i = 0; i < pheromone.length; i++) pheromone[i] *= 0.98;

        // Moving density
        movDens.fill(0);
        newAgents.forEach(a => {
            if (a.state === "moving") {
                const cx = Math.floor(a.x / CELL), cy = Math.floor(a.y / CELL);
                if (inBounds(cx, cy)) movDens[cy * COLS + cx] += 1;
            }
        });

        // AI Logic for Agents
        const SETTLE_DRAIN = 0.05;

        newAgents.forEach(a => {
            if (a.gone) return;
            const cx = Math.floor(a.x / CELL), cy = Math.floor(a.y / CELL);
            const cellI = cy * COLS + cx;

            if (a.state === "seated" || a.state === "standing") {
                a.patience -= dt * 0.05;
                if (a.patience <= 0) {
                    if (a.state === "standing" && inBounds(cx, cy)) {
                        potential[cellI] = Math.min(basePotential[cellI], potential[cellI] + SETTLE_DRAIN);
                    }
                    if (a.targetSeat) {
                        a.targetSeat.occupied = false;
                        a.targetSeat.occupantId = null;
                        a.targetSeat = null;
                    }
                    a.state = "exiting";
                }
                return;
            }

            if (a.state === "exiting") {
                const exitDoors = doors.filter(d => d.type === "exit");
                if (exitDoors.length === 0) { a.gone = true; return; }
                const exit = exitDoors[0];
                const ddx = exit.x - a.x, ddy = exit.y - a.y;
                const dist = Math.hypot(ddx, ddy);
                if (dist < 10) { a.gone = true; return; }
                a.headingX = ddx / dist; a.headingY = ddy / dist;
            } else {
                // Moving / Seeking
                if (a.isVip) {
                    if (!a.targetSeat) {
                        const freeSeats = seats.filter(s => !s.occupied);
                        if (freeSeats.length > 0) {
                            a.targetSeat = freeSeats[Math.floor(Math.random() * freeSeats.length)];
                            a.targetSeat.occupied = true;
                            a.targetSeat.occupantId = a.id;
                        }
                    }
                    if (a.targetSeat) {
                        const tx = a.targetSeat.cx * CELL + CELL / 2, ty = a.targetSeat.cy * CELL + CELL / 2;
                        const dist = Math.hypot(tx - a.x, ty - a.y);
                        if (dist < 5) {
                            a.state = "seated";
                            return;
                        }
                        a.headingX = (tx - a.x) / dist; a.headingY = (ty - a.y) / dist;
                    }
                } else {
                    // Standing behavior - find potential peak
                    let bestP = -1, bestDX = 0, bestDY = 0;
                    for (let dx = -2; dx <= 2; dx++) {
                        for (let dy = -2; dy <= 2; dy++) {
                            const nx = cx + dx, ny = cy + dy;
                            if (inBounds(nx, ny) && venueGrid[ny * COLS + nx]) {
                                const p = potential[ny * COLS + nx] - (movDens[ny * COLS + nx] * 0.1);
                                if (p > bestP) { bestP = p; bestDX = dx; bestDY = dy; }
                            }
                        }
                    }
                    if (bestP > 0) {
                        const m = Math.hypot(bestDX, bestDY) || 1;
                        a.headingX = bestDX / m; a.headingY = bestDY / m;
                    }

                    if (inBounds(cx, cy) && zoneGrid[cellI] === 3 && potential[cellI] > 0.5) {
                        // Chance to settle
                        if (Math.random() < 0.1) {
                            a.state = "standing";
                            potential[cellI] = Math.max(0, potential[cellI] - SETTLE_DRAIN);
                        }
                    }
                }
            }

            // Physics
            a.vx = a.vx * 0.9 + a.headingX * a.speed * 0.1;
            a.vy = a.vy * 0.9 + a.headingY * a.speed * 0.1;
            a.x += a.vx; a.y += a.vy;

            // Boundary checks
            const ncx = Math.floor(a.x / CELL), ncy = Math.floor(a.y / CELL);
            if (!inBounds(ncx, ncy) || !venueGrid[ncy * COLS + ncx]) {
                a.x -= a.vx; a.y -= a.vy;
                a.vx *= -0.5; a.vy *= -0.5;
            }

            // Lay pheromone
            if (inBounds(ncx, ncy)) pheromone[ncy * COLS + ncx] += 0.1;
        });

        setAgents(newAgents.filter(a => !a.gone));
        setStats(prev => ({
            total: newAgents.length,
            seated: newAgents.filter(a => a.state === "seated").length,
            standing: newAgents.filter(a => a.state === "standing").length,
            moving: newAgents.filter(a => a.state === "moving").length,
            exited: prev.exited + (agents.length - newAgents.length),
            peak: Math.max(prev.peak, newAgents.length)
        }));
    }, [agents, doors, simRunning, simPaused, maxAgents, spawnAgent]);

    // --- Render Loop ---

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d")!;
        const wrap = canvas.parentElement!;

        const handleResize = () => {
            canvas.width = wrap.clientWidth;
            canvas.height = wrap.clientHeight;
            const COLS = Math.ceil(canvas.width / CELL);
            const ROWS = Math.ceil(canvas.height / CELL);
            gridsRef.current = {
                COLS, ROWS,
                venueGrid: new Uint8Array(COLS * ROWS),
                zoneGrid: new Uint8Array(COLS * ROWS),
                potential: new Float32Array(COLS * ROWS),
                basePotential: new Float32Array(COLS * ROWS),
                pheromone: new Float32Array(COLS * ROWS),
                zoneIdGrid: new Uint8Array(COLS * ROWS),
                movDens: new Float32Array(COLS * ROWS),
                seats: [],
                stageCX: COLS / 2, stageCY: ROWS / 4
            };
            rebuildGrids();
        };

        handleResize();
        window.addEventListener("resize", handleResize);

        let raf: number;
        const render = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const { COLS, ROWS, venueGrid, zoneGrid, potential, pheromone, seats } = gridsRef.current;

            // Grids
            for (let cy = 0; cy < ROWS; cy++) {
                for (let cx = 0; cx < COLS; cx++) {
                    const i = cy * COLS + cx;
                    if (venueGrid[i]) {
                        ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
                        if (zoneGrid[i] === 1) ctx.fillStyle = "rgba(99, 102, 241, 0.15)";
                        if (zoneGrid[i] === 3) ctx.fillStyle = `rgba(245, 158, 11, ${potential[i] * 0.2})`;
                        ctx.fillRect(cx * CELL, cy * CELL, CELL, CELL);
                    }
                    if (pheromone[i] > 0.01) {
                        ctx.fillStyle = `rgba(129, 140, 248, ${pheromone[i] * 0.2})`;
                        ctx.fillRect(cx * CELL, cy * CELL, CELL, CELL);
                    }
                }
            }

            // Seats
            seats.forEach(s => {
                ctx.fillStyle = s.occupied ? "rgba(139, 92, 246, 0.6)" : "rgba(34, 197, 94, 0.2)";
                ctx.fillRect(s.cx * CELL + 1, s.cy * CELL + 1, CELL - 2, CELL - 2);
            });

            // Polygons
            ctx.lineWidth = 1.5;
            polygons.forEach(p => {
                ctx.beginPath();
                ctx.strokeStyle = p.type === "venue" ? "rgba(255,255,255,0.4)" : p.type === "stage" ? "var(--accent-primary)" : "var(--text-muted)";
                ctx.setLineDash(p.closed ? [] : [5, 5]);
                p.points.forEach((pt, i) => i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y));
                if (p.closed) ctx.closePath();
                ctx.stroke();
            });

            if (currentPoly) {
                ctx.beginPath();
                ctx.strokeStyle = "var(--text-accent)";
                ctx.setLineDash([5, 5]);
                currentPoly.points.forEach((pt, i) => i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y));
                ctx.lineTo(mousePos.x, mousePos.y);
                ctx.stroke();
            }

            // Doors
            doors.forEach(d => {
                ctx.beginPath();
                ctx.fillStyle = d.type === "exit" ? "var(--danger)" : d.type === "door-vip" ? "var(--accent-secondary)" : "var(--info)";
                ctx.arc(d.x, d.y, 6, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = "white";
                ctx.lineWidth = 2;
                ctx.stroke();
            });

            // Agents
            agents.forEach(a => {
                ctx.beginPath();
                ctx.fillStyle = a.isVip ? "var(--accent-secondary)" : a.state === "exiting" ? "var(--danger)" : "var(--success)";
                ctx.arc(a.x, a.y, a.isVip ? 3 : 2, 0, Math.PI * 2);
                ctx.fill();
            });

            // Measurements Overlay
            if (hoveredMeasurement) {
                ctx.fillStyle = "var(--bg-elevated)";
                ctx.strokeStyle = "var(--text-accent)";
                ctx.font = "bold 10px var(--font-mono)";
                const tw = ctx.measureText(hoveredMeasurement).width;
                ctx.fillRect(mousePos.x + 10, mousePos.y - 25, tw + 10, 20);
                ctx.strokeRect(mousePos.x + 10, mousePos.y - 25, tw + 10, 20);
                ctx.fillStyle = "var(--text-accent)";
                ctx.fillText(hoveredMeasurement, mousePos.x + 15, mousePos.y - 12);
            }

            if (simRunning && !simPaused) {
                step(0.016 * speedMult);
            }

            raf = requestAnimationFrame(render);
        };

        raf = requestAnimationFrame(render);
        return () => {
            window.removeEventListener("resize", handleResize);
            cancelAnimationFrame(raf);
        };
    }, [polygons, currentPoly, doors, agents, simRunning, simPaused, speedMult, hoveredMeasurement, mousePos, step, rebuildGrids]);

    return (
        <div className="panel" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
            <div className="panel-header">
                <h3>
                    <span className="icon">👥</span>
                    Crowd Simulation
                </h3>
                <div style={{ display: "flex", gap: "6px" }}>
                    <button
                        className={`btn ${simRunning ? "btn-secondary" : "btn-primary"} `}
                        onClick={() => {
                            if (!simRunning) {
                                setSimRunning(true);
                                setSimPaused(false);
                            } else {
                                setSimPaused(!simPaused);
                            }
                        }}
                        style={{ fontSize: "10px", padding: "4px 10px" }}
                    >
                        {simRunning ? (simPaused ? "▶ Resume" : "⏸ Pause") : "▶ Run Sim"}
                    </button>
                    <button
                        className="btn btn-secondary"
                        onClick={() => {
                            setSimRunning(false);
                            setAgents([]);
                            setStats(s => ({ ...s, exited: 0, peak: 0 }));
                        }}
                        style={{ fontSize: "10px", padding: "4px 10px" }}
                    >
                        ↺ Reset
                    </button>
                </div>
            </div>

            <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
                {/* Sidebar */}
                <div style={{
                    width: "160px",
                    borderRight: "1px solid var(--border-primary)",
                    padding: "10px",
                    overflowY: "auto",
                    background: "rgba(255,255,255,0.01)"
                }}>
                    <div className="sb-section" style={{ marginBottom: "12px" }}>
                        <label style={{ fontSize: "8px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: "6px" }}>
                            Design Tools
                        </label>
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            {(["venue", "stage", "seating", "standing"] as PolyType[]).map(tool => (
                                <button
                                    key={tool}
                                    className={`btn ${currentTool === tool ? "btn-primary" : "btn-secondary"}`}
                                    onClick={() => setCurrentTool(tool)}
                                    style={{ fontSize: "9px", width: "100%", justifyContent: "flex-start", padding: "5px 8px" }}
                                >
                                    {tool.toUpperCase()}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="sb-section" style={{ marginBottom: "12px" }}>
                        <label style={{ fontSize: "8px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: "6px" }}>
                            Entry / Exits
                        </label>
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            {(["door-gen", "door-vip", "exit"] as DoorType[]).map(tool => (
                                <button
                                    key={tool}
                                    className={`btn ${currentTool === tool ? "btn-primary" : "btn-secondary"}`}
                                    onClick={() => setCurrentTool(tool)}
                                    style={{ fontSize: "9px", width: "100%", justifyContent: "flex-start", padding: "5px 8px" }}
                                >
                                    {tool.replace("door-", "").toUpperCase()}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="sb-section">
                        <label style={{ fontSize: "8px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: "6px" }}>
                            Utility
                        </label>
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            <button
                                className={`btn ${currentTool === "delete" ? "btn-primary" : "btn-secondary"}`}
                                onClick={() => setCurrentTool("delete")}
                                style={{ fontSize: "9px", width: "100%", justifyContent: "flex-start", padding: "5px 8px", color: currentTool === "delete" ? "#fff" : "var(--danger)" }}
                            >
                                ✕ DELETE
                            </button>
                            <button
                                className={`btn ${currentTool === "measure" ? "btn-primary" : "btn-secondary"}`}
                                onClick={() => setCurrentTool("measure")}
                                style={{ fontSize: "9px", width: "100%", justifyContent: "flex-start", padding: "5px 8px" }}
                            >
                                📏 MEASURE
                            </button>
                        </div>
                    </div>
                </div>

                {/* Canvas Area */}
                <div style={{ flex: 1, position: "relative", background: "#0a0b10" }}>
                    <canvas
                        ref={canvasRef}
                        onClick={handleCanvasClick}
                        onMouseMove={handleMouseMove}
                        style={{ width: "100%", height: "100%", cursor: currentTool === "delete" ? "pointer" : "crosshair" }}
                    />

                    {/* Measurements & Legend Overlay */}
                    <div style={{
                        position: "absolute", bottom: "10px", right: "10px",
                        padding: "6px 10px", background: "rgba(0,0,0,0.6)",
                        borderRadius: "var(--radius-sm)", border: "1px solid var(--border-primary)",
                        display: "flex", gap: "10px", fontSize: "10px", color: "var(--text-secondary)"
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--success)" }} /> General
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--accent-secondary)" }} /> VIP
                        </div>
                        <div style={{ paddingLeft: "10px", borderLeft: "1px solid var(--border-primary)", color: "var(--text-accent)" }}>
                            Scale: 1m = {PIXELS_PER_METER}px
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Stats */}
            <div style={{
                height: "50px", borderTop: "1px solid var(--border-primary)",
                display: "flex", alignItems: "center", padding: "0 15px", gap: "25px",
                background: "var(--bg-secondary)"
            }}>
                <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: "8px", color: "var(--text-muted)", textTransform: "uppercase" }}>In Venue</span>
                    <span style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>{stats.total}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: "8px", color: "var(--text-muted)", textTransform: "uppercase" }}>Moving</span>
                    <span style={{ fontSize: "16px", fontWeight: 700, color: "var(--info)" }}>{stats.moving}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: "8px", color: "var(--text-muted)", textTransform: "uppercase" }}>Standing</span>
                    <span style={{ fontSize: "16px", fontWeight: 700, color: "var(--warning)" }}>{stats.standing}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: "8px", color: "var(--text-muted)", textTransform: "uppercase" }}>VIP Seated</span>
                    <span style={{ fontSize: "16px", fontWeight: 700, color: "var(--accent-secondary)" }}>{stats.seated}</span>
                </div>
                <div style={{ marginLeft: "auto", display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                    <span style={{ fontSize: "8px", color: "var(--text-muted)", textTransform: "uppercase" }}>Peak Crowd</span>
                    <span style={{ fontSize: "16px", fontWeight: 700, color: "var(--danger)" }}>{stats.peak}</span>
                </div>
            </div>
        </div>
    );
}
