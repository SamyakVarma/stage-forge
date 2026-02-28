"use client";
/* eslint-disable @next/next/no-img-element */
import { useState, Suspense, useMemo, useRef, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, Text, Billboard, SpotLight, useGLTF } from "@react-three/drei";
import { useScene } from "../context/SceneContext";
import * as THREE from "three";

// ============================================
// Model Component
// ============================================
function Model({ url, width, height, depth }: { url: string; width: number; height: number; depth: number }) {
    const { scene } = useGLTF(url);
    const cloned = useMemo(() => scene.clone(true), [scene, url]);

    // Auto-scale model to fit defined asset bounds
    const box = useMemo(() => new THREE.Box3().setFromObject(cloned), [cloned]);
    const size = box.getSize(new THREE.Vector3());
    const scaleX = width / size.x;
    const scaleY = height / size.y;
    const scaleZ = depth / size.z;

    const finalScale = Math.min(scaleX, scaleY, scaleZ);

    return (
        <group position={[0, -height / 2, 0]}>
            <primitive object={cloned} scale={[finalScale, finalScale, finalScale]} />
        </group>
    );
}

// ============================================
// 3D Prop Component
// ============================================
function Prop3D({ prop, asset, stageHeight, isSelected }: { prop: any; asset?: any; stageHeight: number; isSelected: boolean }) {
    const { setSelectedPropId } = useScene();
    const [hovered, setHovered] = useState(false);
    const targetRef = useRef<THREE.Object3D>(null);

    const width = (asset?.width || 1) * prop.scale.x;
    const height = (asset?.height || 1) * prop.scale.y;
    const depth = (asset?.depth || 0.1) * prop.scale.z;

    const isStructure = asset?.category === "structure" || asset?.category === "screens";
    const hasImage = !!asset?.imageUrl;

    const texture = useMemo(() => {
        if (hasImage && !isStructure) {
            const loader = new THREE.TextureLoader();
            try {
                const t = loader.load(asset.imageUrl!);
                t.colorSpace = THREE.SRGBColorSpace;
                return t;
            } catch { return null; }
        }
        return null;
    }, [hasImage, isStructure, asset?.imageUrl]);

    const usePlaneTexture = texture !== null;
    const use3DModel = !!asset?.modelUrl;

    const lightColor = prop.lightColor || asset?.lightColor || getCategoryColor(asset?.name || "");
    const lightPower = prop.lightPower ?? asset?.lightPower ?? 2;
    const lightAngle = prop.lightAngle ?? asset?.lightAngle ?? 0.4;
    const lightPenumbra = prop.lightPenumbra ?? 0.5;

    return (
        <group
            position={[prop.position.x, stageHeight + prop.position.y + height / 2, prop.position.z]}
            rotation={[
                (prop.rotation.x * Math.PI) / 180,
                (prop.rotation.y * Math.PI) / 180,
                (prop.rotation.z * Math.PI) / 180,
            ]}
            onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
            onPointerOut={() => setHovered(false)}
            onClick={(e) => { e.stopPropagation(); setSelectedPropId(prop.id); }}
        >
            {use3DModel ? (
                <Suspense fallback={<mesh><boxGeometry args={[width, height, depth]} /><meshStandardMaterial wireframe color="#6366f1" /></mesh>}>
                    <Model url={asset!.modelUrl!} width={width} height={height} depth={depth} />
                </Suspense>
            ) : usePlaneTexture ? (
                <mesh>
                    <planeGeometry args={[width, height]} />
                    <meshStandardMaterial map={texture} transparent alphaTest={0.05} side={THREE.DoubleSide} emissive={isSelected || hovered ? "#6366f1" : "#000000"} emissiveIntensity={isSelected ? 0.5 : (hovered ? 0.3 : 0)} />
                </mesh>
            ) : (
                <mesh>
                    <boxGeometry args={[width, height, depth]} />
                    <meshStandardMaterial color={getCategoryColor(asset?.name || "")} transparent opacity={hovered ? 0.9 : 0.7} emissive={isSelected || hovered ? "#6366f1" : "#000000"} emissiveIntensity={isSelected ? 0.5 : (hovered ? 0.4 : 0)} />
                </mesh>
            )}

            {asset?.category === "lighting" && asset?.lightType !== "panel" && (
                <group position={[0, -height / 2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                    <SpotLight
                        distance={30}
                        angle={lightAngle}
                        penumbra={lightPenumbra}
                        attenuation={5}
                        anglePower={5}
                        color={lightColor}
                        intensity={lightPower * 10} // Boosted for better visibility
                        target={targetRef.current || undefined}
                    />
                    <object3D ref={targetRef as any} position={[0, 0, -1]} />
                </group>
            )}

            {asset?.category === "lighting" && asset?.lightType === "panel" && (
                <rectAreaLight
                    width={width}
                    height={height}
                    color={lightColor}
                    intensity={lightPower * 20} // Panel lights need high intensity
                    position={[0, 0, 0]}
                    rotation={[-Math.PI / 2, 0, 0]}
                />
            )}


            {isSelected && (
                <mesh position={[0, -height / 2 + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                    <ringGeometry args={[Math.max(width, depth) * 0.7, Math.max(width, depth) * 0.8, 32]} />
                    <meshBasicMaterial color="#facc15" transparent opacity={0.8} side={THREE.DoubleSide} />
                </mesh>
            )}
        </group>
    );
}

function getCategoryColor(name: string): string {
    const lower = name.toLowerCase();
    if (lower.includes("mic") || lower.includes("drum") || lower.includes("keyboard") || lower.includes("guitar")) return "#6366f1";
    if (lower.includes("speaker") || lower.includes("monitor") || lower.includes("sub")) return "#f59e0b";
    if (lower.includes("light") || lower.includes("led") && !lower.includes("wall")) return "#facc15";
    if (lower.includes("wall") || lower.includes("screen")) return "#3b82f6";
    return "#6b7280";
}

// Scene3D component
function Scene3D() {
    const { scene, getVisibleProps, getInterpolatedProp, getAssetById } = useScene();
    const visibleProps = getVisibleProps();

    return (
        <>
            <OrbitControls makeDefault enableDamping minDistance={5} maxDistance={100} />
            <ambientLight intensity={0.4} />
            <directionalLight position={[10, 15, 10]} intensity={0.5} />
            <fog attach="fog" args={["#0a0b10", 30, 120]} />

            <Grid args={[100, 100]} position={[0, -0.01, 0]} cellSize={1} sectionSize={5} fadeDistance={50} infiniteGrid />

            <mesh position={[0, scene.meta.stageHeight / 2, 0]}>
                <boxGeometry args={[scene.meta.stageWidth, scene.meta.stageHeight, scene.meta.stageDepth]} />
                <meshStandardMaterial color="#1a1b2e" />
            </mesh>

            {visibleProps.map((p) => {
                const prop = getInterpolatedProp(p.id) || p;
                const asset = getAssetById(prop.assetId);
                return <Prop3D key={prop.id} prop={prop} asset={asset} stageHeight={scene.meta.stageHeight} isSelected={scene.selectedPropId === prop.id} />;
            })}
        </>
    );
}

// 2D Front View
function Scene2DFrontView() {
    const { scene, getVisibleProps, getAssetById, updateProp, setSelectedPropId, getInterpolatedProp } = useScene();
    const visibleProps = getVisibleProps();

    // Pan & Zoom state
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);

    const [draggingId, setDraggingId] = useState<string | null>(null);

    const svgWidth = 800;
    const svgHeight = 500;
    const baseScale = svgWidth / (scene.meta.stageWidth + 10);
    const currentScale = baseScale * zoom;

    const offsetX = svgWidth / 2 + pan.x;
    const stageTop = svgHeight * 0.8 + pan.y;

    const handlePointerDown = (e: React.PointerEvent) => {
        if (e.button === 1 || (e.button === 0 && e.altKey)) {
            setIsPanning(true);
            return;
        }
        setSelectedPropId(null);
    };

    const handlePropPointerDown = (e: React.PointerEvent, propId: string) => {
        e.stopPropagation();
        setSelectedPropId(propId);
        setDraggingId(propId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (isPanning) {
            setPan(p => ({ x: p.x + e.movementX, y: p.y + e.movementY }));
            return;
        }
        if (!draggingId) return;

        const prop = scene.props.find(p => p.id === draggingId);
        if (!prop) return;

        updateProp(draggingId, {
            position: {
                ...prop.position,
                x: prop.position.x + e.movementX / currentScale,
                y: Math.max(0, prop.position.y - e.movementY / currentScale)
            }
        });
    };

    const handlePointerUp = () => {
        setIsPanning(false);
        setDraggingId(null);
    };

    const handleWheel = (e: React.WheelEvent) => {
        if (e.ctrlKey) {
            // Zoom
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            setZoom(z => Math.max(0.2, Math.min(10, z * delta)));
        } else if (draggingId) {
            const prop = scene.props.find(p => p.id === draggingId);
            if (!prop) return;
            if (e.shiftKey) {
                const delta = e.deltaY > 0 ? 15 : -15;
                updateProp(draggingId, { rotation: { ...prop.rotation, z: (prop.rotation.z + delta) % 360 } });
            } else {
                const delta = e.deltaY > 0 ? 0.9 : 1.1;
                updateProp(draggingId, { scale: { x: prop.scale.x * delta, y: prop.scale.y * delta, z: prop.scale.z * delta } });
            }
        }
    };

    return (
        <div
            style={{ width: "100%", height: "100%", position: "relative", cursor: isPanning ? "grabbing" : draggingId ? "grabbing" : "default" }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onWheel={handleWheel}
        >
            <svg width="100%" height="100%" viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ touchAction: "none", background: "#0a0b10" }}>
                <defs>
                    <radialGradient id="lightGradient">
                        <stop offset="0%" stopColor="white" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="white" stopOpacity="0" />
                    </radialGradient>
                </defs>

                {/* Grid */}
                <g opacity="0.1">
                    {Array.from({ length: 21 }).map((_, i) => (
                        <line key={`v-${i}`} x1={offsetX + (i - 10) * currentScale} y1={0} x2={offsetX + (i - 10) * currentScale} y2={svgHeight} stroke="white" />
                    ))}
                </g>

                {/* Stage */}
                <rect
                    x={offsetX - (scene.meta.stageWidth * currentScale) / 2}
                    y={stageTop - scene.meta.stageHeight * currentScale}
                    width={scene.meta.stageWidth * currentScale}
                    height={scene.meta.stageHeight * currentScale}
                    fill="#1a1b2e" stroke="#6366f1" strokeWidth="2"
                />

                {visibleProps.map((p) => {
                    const prop = getInterpolatedProp(p.id) || p;
                    const asset = getAssetById(prop.assetId);
                    const propW = (asset?.width || 1) * prop.scale.x * currentScale;
                    const propH = (asset?.height || 1) * prop.scale.y * currentScale;
                    const propX = offsetX + prop.position.x * currentScale;
                    const propY = stageTop - (scene.meta.stageHeight + prop.position.y) * currentScale - propH;

                    const lightColor = prop.lightColor || asset?.lightColor || "#ffffff";
                    const isSelected = scene.selectedPropId === prop.id;

                    return (
                        <g
                            key={prop.id}
                            transform={`rotate(${-prop.rotation.z}, ${propX}, ${propY + propH / 2})`}
                            onPointerDown={(e) => handlePropPointerDown(e, prop.id)}
                            onWheel={(e) => {
                                e.stopPropagation();
                                const propToUpdate = scene.props.find(p => p.id === prop.id);
                                if (!propToUpdate) return;

                                if (e.shiftKey) {
                                    // Rotate around Z axis (front view)
                                    const delta = e.deltaY > 0 ? 5 : -5;
                                    updateProp(prop.id, { rotation: { ...propToUpdate.rotation, z: (propToUpdate.rotation.z + delta) % 360 } });
                                } else if (!e.ctrlKey) {
                                    // Scale
                                    const delta = e.deltaY > 0 ? 0.9 : 1.1;
                                    updateProp(prop.id, { scale: { x: propToUpdate.scale.x * delta, y: propToUpdate.scale.y * delta, z: propToUpdate.scale.z * delta } });
                                }
                            }}
                            style={{ cursor: "pointer" }}
                        >
                            {asset?.category === "lighting" && (
                                <path
                                    d={`M ${propX} ${propY + propH} L ${propX - propW * 2} ${propY + propH + 300} L ${propX + propW * 2} ${propY + propH + 300} Z`}
                                    fill={lightColor} opacity="0.15"
                                    style={{ mixBlendMode: 'screen', pointerEvents: 'none' }}
                                />
                            )}
                            {asset?.imageUrl ? (
                                <image href={asset.imageUrl} x={propX - propW / 2} y={propY} width={propW} height={propH} />
                            ) : (
                                <rect x={propX - propW / 2} y={propY} width={propW} height={propH} fill={getCategoryColor(asset?.name || "")} />
                            )}
                            {isSelected && <rect x={propX - propW / 2 - 2} y={propY - 2} width={propW + 4} height={propH + 4} fill="none" stroke="#facc15" strokeWidth="2" strokeDasharray="4 2" />}
                        </g>
                    );
                })}

            </svg>
            <div style={{ position: "absolute", bottom: 10, left: 10, color: "white", fontSize: "10px", pointerEvents: "none", background: "rgba(0,0,0,0.5)", padding: "4px" }}>
                Alt + Drag: Pan | Ctrl + Scroll: Zoom | Click: Select | Delete: Remove
            </div>
        </div>
    );
}

// Main Viewport
export default function Viewport3D() {
    const [viewMode, setViewMode] = useState<"3d" | "2d">("3d");
    const { scene, removeProp } = useScene();

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Delete" || e.key === "Backspace") {
                if (scene.selectedPropId && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
                    removeProp(scene.selectedPropId);
                }
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [scene.selectedPropId, removeProp]);

    return (
        <div className="panel" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
            <div className="panel-header">
                <h3>{viewMode === "3d" ? "🎬 3D Viewport" : "📏 2D Front View"}</h3>
                <div className="toggle-group">
                    <button className={`toggle-btn ${viewMode === "3d" ? "active" : ""}`} onClick={() => setViewMode("3d")}>3D</button>
                    <button className={`toggle-btn ${viewMode === "2d" ? "active" : ""}`} onClick={() => setViewMode("2d")}>2D</button>
                </div>
            </div>
            <div style={{ flex: 1 }}>
                {viewMode === "3d" ? (
                    <Canvas camera={{ position: [0, 10, 30], fov: 45 }} style={{ background: "#0a0b10" }}>
                        <Scene3D />
                    </Canvas>
                ) : (
                    <Scene2DFrontView />
                )}
            </div>
        </div>
    );
}
