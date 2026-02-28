"use client";
import { useState } from "react";

interface ExitMarker {
    id: string;
    label: string;
    x: number;
    y: number;
    direction: "up" | "down" | "left" | "right";
}

interface Zone {
    id: string;
    label: string;
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
    capacity: number;
}

const defaultZones: Zone[] = [
    { id: "vip-pit", label: "VIP PIT", x: 30, y: 8, width: 40, height: 18, color: "rgba(236, 72, 153, 0.12)", capacity: 300 },
    { id: "general", label: "GENERAL", x: 15, y: 30, width: 70, height: 30, color: "rgba(99, 102, 241, 0.08)", capacity: 2000 },
    { id: "seated-left", label: "SEATED L", x: 5, y: 32, width: 10, height: 26, color: "rgba(59, 130, 246, 0.1)", capacity: 500 },
    { id: "seated-right", label: "SEATED R", x: 85, y: 32, width: 10, height: 26, color: "rgba(59, 130, 246, 0.1)", capacity: 500 },
    { id: "rear-seated", label: "REAR SEATS", x: 20, y: 64, width: 60, height: 16, color: "rgba(34, 197, 94, 0.08)", capacity: 2700 },
];

const defaultExits: ExitMarker[] = [
    { id: "exit-1", label: "EXIT 1", x: 2, y: 45, direction: "left" },
    { id: "exit-2", label: "EXIT 2", x: 92, y: 45, direction: "right" },
    { id: "exit-3", label: "EXIT 3", x: 35, y: 88, direction: "down" },
    { id: "exit-4", label: "EXIT 4", x: 60, y: 88, direction: "down" },
];

const directionArrow: Record<string, string> = {
    up: "↑",
    down: "↓",
    left: "←",
    right: "→",
};

export default function CrowdAreaView() {
    const [exits, setExits] = useState<ExitMarker[]>(defaultExits);
    const [zones] = useState<Zone[]>(defaultZones);
    const [isAdding, setIsAdding] = useState(false);
    const [hoveredZone, setHoveredZone] = useState<string | null>(null);

    const handleAddExit = () => {
        if (isAdding) {
            setIsAdding(false);
            return;
        }
        setIsAdding(true);
    };

    const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isAdding) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        let direction: "up" | "down" | "left" | "right" = "down";
        if (y < 20) direction = "up";
        else if (y > 80) direction = "down";
        else if (x < 20) direction = "left";
        else if (x > 80) direction = "right";

        const newExit: ExitMarker = {
            id: `exit-${exits.length + 1}`,
            label: `EXIT ${exits.length + 1}`,
            x,
            y,
            direction,
        };
        setExits([...exits, newExit]);
        setIsAdding(false);
    };

    return (
        <div className="panel" style={{ height: "100%" }}>
            <div className="panel-header">
                <h3>
                    <span className="icon">👥</span>
                    Crowd Area
                </h3>
                <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                    <span style={{ fontSize: "9px", color: "var(--text-muted)", marginRight: "4px" }}>
                        {exits.length} exits
                    </span>
                    <button
                        className={`btn ${isAdding ? "btn-primary" : "btn-secondary"}`}
                        onClick={handleAddExit}
                        style={{ fontSize: "10px", padding: "3px 8px" }}
                    >
                        {isAdding ? "✕ Cancel" : "+ Exit"}
                    </button>
                </div>
            </div>
            <div
                className="panel-body"
                style={{
                    padding: 0,
                    cursor: isAdding ? "crosshair" : "default",
                }}
                onClick={handleCanvasClick}
            >
                <div className="grid-canvas" style={{ position: "relative", height: "100%" }}>
                    {/* Stage indicator at top */}
                    <div style={{
                        position: "absolute",
                        top: "2%",
                        left: "30%",
                        width: "40%",
                        height: "5%",
                        background: "rgba(99, 102, 241, 0.15)",
                        border: "1px solid rgba(99, 102, 241, 0.3)",
                        borderRadius: "3px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}>
                        <span style={{ fontSize: "7px", fontWeight: 600, color: "rgba(99, 102, 241, 0.6)", letterSpacing: "0.15em" }}>
                            STAGE
                        </span>
                    </div>

                    {/* Crowd zones */}
                    {zones.map((zone) => (
                        <div
                            key={zone.id}
                            className="zone-overlay"
                            onMouseEnter={() => setHoveredZone(zone.id)}
                            onMouseLeave={() => setHoveredZone(null)}
                            style={{
                                left: `${zone.x}%`,
                                top: `${zone.y}%`,
                                width: `${zone.width}%`,
                                height: `${zone.height}%`,
                                background: zone.color,
                                borderColor: zone.color.replace("0.08", "0.3").replace("0.1", "0.35").replace("0.12", "0.4"),
                            }}
                        >
                            <div style={{ textAlign: "center" }}>
                                <div style={{ color: zone.color.replace("0.08", "0.7").replace("0.1", "0.7").replace("0.12", "0.7"), fontSize: "8px", fontWeight: 600, letterSpacing: "0.08em" }}>
                                    {zone.label}
                                </div>
                                {hoveredZone === zone.id && (
                                    <div style={{ color: "var(--text-muted)", fontSize: "8px", marginTop: "2px" }}>
                                        Cap: {zone.capacity.toLocaleString()}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {/* Heatmap underlays */}
                    <div className="heatmap-zone" style={{ left: "35%", top: "15%", width: "30%", height: "20%", background: "rgba(239, 68, 68, 0.5)" }} />
                    <div className="heatmap-zone" style={{ left: "30%", top: "35%", width: "40%", height: "25%", background: "rgba(245, 158, 11, 0.3)" }} />
                    <div className="heatmap-zone" style={{ left: "25%", top: "55%", width: "50%", height: "20%", background: "rgba(34, 197, 94, 0.2)" }} />

                    {/* Exit markers */}
                    {exits.map((exit) => (
                        <div
                            key={exit.id}
                            className="exit-marker"
                            style={{
                                left: `${exit.x}%`,
                                top: `${exit.y}%`,
                            }}
                        >
                            <div className="exit-icon">{directionArrow[exit.direction]}</div>
                            <span>{exit.label}</span>
                        </div>
                    ))}

                    {/* Adding mode indicator */}
                    {isAdding && (
                        <div style={{
                            position: "absolute",
                            top: "50%",
                            left: "50%",
                            transform: "translate(-50%, -50%)",
                            padding: "6px 14px",
                            background: "rgba(99, 102, 241, 0.15)",
                            border: "1px solid rgba(99, 102, 241, 0.3)",
                            borderRadius: "var(--radius-md)",
                            fontSize: "10px",
                            color: "var(--text-accent)",
                            pointerEvents: "none",
                            animation: "pulse 1.5s ease-in-out infinite",
                        }}>
                            Click to place exit marker
                        </div>
                    )}

                    {/* Legend */}
                    <div style={{
                        position: "absolute",
                        bottom: "6px",
                        left: "8px",
                        display: "flex",
                        gap: "10px",
                        fontSize: "8px",
                        color: "var(--text-muted)",
                    }}>
                        <span style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "rgba(239, 68, 68, 0.5)" }} /> High
                        </span>
                        <span style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "rgba(245, 158, 11, 0.4)" }} /> Med
                        </span>
                        <span style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "rgba(34, 197, 94, 0.3)" }} /> Low
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
