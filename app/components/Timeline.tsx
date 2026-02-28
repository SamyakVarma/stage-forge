"use client";
import { useRef, useCallback } from "react";
import { useScene } from "../context/SceneContext";

const layerConfig: Record<string, { label: string; icon: string; color: string }> = {
    lighting: { label: "Lighting", icon: "💡", color: "rgba(139, 92, 246, 0.6)" },
    screens: { label: "Screens", icon: "🖥️", color: "rgba(59, 130, 246, 0.6)" },
    props: { label: "Props", icon: "🎭", color: "rgba(99, 102, 241, 0.6)" },
    audio: { label: "Audio", icon: "🔊", color: "rgba(34, 197, 94, 0.5)" },
    structure: { label: "Structure", icon: "🏗️", color: "rgba(107, 114, 128, 0.5)" },
    decor: { label: "Decor", icon: "🎨", color: "rgba(236, 72, 153, 0.6)" },
};

const BLOCK_COLORS = [
    "rgba(245, 158, 11, 0.65)",
    "rgba(239, 68, 68, 0.6)",
    "rgba(139, 92, 246, 0.65)",
    "rgba(59, 130, 246, 0.6)",
];

export default function Timeline() {
    const { scene, setCurrentTime, updateProp, setSelectedPropId, isPlaying, setPlaying } = useScene();
    const timelineRef = useRef<HTMLDivElement>(null);
    const duration = scene.meta.duration || 180;
    const timelineWidth = 1500; // Fixed width for horizontal scrolling

    const layers = Object.keys(layerConfig);
    const propsByLayer: Record<string, typeof scene.props> = {};
    for (const layer of layers) {
        propsByLayer[layer] = scene.props.filter((p) => p.layer === layer);
    }

    const handleTimelineClick = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            if (!timelineRef.current) return;
            const rect = timelineRef.current.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            const time = (x / 100) * duration;
            setCurrentTime(Math.max(0, Math.min(duration, time)));
        },
        [duration, setCurrentTime]
    );

    const addKeyframe = (propId: string) => {
        const prop = scene.props.find(p => p.id === propId);
        if (!prop) return;
        const newKf = {
            time: scene.currentTime,
            position: { ...prop.position },
            rotation: { ...prop.rotation },
            scale: { ...prop.scale },
            lightPower: prop.lightPower,
            lightAngle: prop.lightAngle,
            lightPenumbra: prop.lightPenumbra,
        };

        const currentKfs = prop.keyframes || [];
        updateProp(propId, { keyframes: [...currentKfs, newKf] });
    };

    const currentPercent = (scene.currentTime / duration) * 100;

    return (
        <div className="panel" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
            <div className="panel-header">
                <h3>⏱️ Timeline</h3>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ display: "flex", gap: "5px" }}>
                        <button className="btn btn-ghost" style={{ padding: "4px 8px" }} title="Stop" onClick={() => { setPlaying(false); setCurrentTime(0); }}>⏹️</button>
                        <button
                            className={`btn ${isPlaying ? "btn-secondary" : "btn-primary"}`}
                            style={{ padding: "4px 12px", display: "flex", alignItems: "center", gap: "4px" }}
                            onClick={() => setPlaying(!isPlaying)}
                        >
                            {isPlaying ? "⏸️ Pause" : "▶️ Play"}
                        </button>
                    </div>
                    <span style={{ fontSize: "11px", fontFamily: "monospace", color: "var(--text-accent)", minWidth: "90px" }}>
                        {Math.floor(scene.currentTime / 60)}:{String(Math.floor(scene.currentTime % 60)).padStart(2, "0")} / {Math.floor(duration / 60)}:{String(duration % 60).padStart(2, "0")}
                    </span>
                    {scene.selectedPropId && (
                        <button className="btn btn-primary" style={{ padding: "4px 10px", fontSize: "10px" }} onClick={() => addKeyframe(scene.selectedPropId!)}>+ Key</button>
                    )}
                </div>
            </div>

            <div className="panel-body" style={{ flex: 1, padding: "10px", overflowX: "auto", overflowY: "auto", position: "relative" }}>
                <div ref={timelineRef} style={{ position: "relative", minHeight: "200px", width: `${timelineWidth}px`, cursor: "crosshair" }} onClick={handleTimelineClick}>
                    {/* Time Ruler */}
                    <div style={{ height: "20px", borderBottom: "1px solid var(--border-primary)", display: "flex", justifyContent: "space-between", marginBottom: "15px" }}>
                        {Array.from({ length: 11 }).map((_, i) => (
                            <span key={i} style={{ fontSize: "8px", color: "var(--text-muted)" }}>{Math.floor((duration / 10) * i)}s</span>
                        ))}
                    </div>

                    {layers.filter(l => propsByLayer[l]?.length > 0 || ["lighting", "props"].includes(l)).map(layer => (
                        <div key={layer} style={{ marginBottom: "15px" }}>
                            <div style={{
                                fontSize: "10px",
                                color: "var(--text-muted)",
                                marginBottom: "6px",
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                                borderBottom: "1px solid rgba(255,255,255,0.05)",
                                paddingBottom: "2px"
                            }}>
                                <span>{layerConfig[layer].icon}</span> {layerConfig[layer].label}
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                {propsByLayer[layer].map((prop, i) => {
                                    const start = (prop.enterTime / duration) * 100;
                                    const end = prop.exitTime > 0 ? (prop.exitTime / duration) * 100 : 100;
                                    const isSelected = scene.selectedPropId === prop.id;

                                    return (
                                        <div key={prop.id} style={{ display: "flex", alignItems: "center", gap: "8px", height: "18px" }}>
                                            {/* Track Label */}
                                            <div style={{
                                                width: "120px",
                                                fontSize: "8px",
                                                color: isSelected ? "var(--text-accent)" : "var(--text-muted)",
                                                whiteSpace: "nowrap",
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                fontWeight: isSelected ? 600 : 400
                                            }}>
                                                {prop.label}
                                            </div>

                                            {/* Track Area */}
                                            <div style={{
                                                flex: 1,
                                                height: "100%",
                                                background: "rgba(255,255,255,0.02)",
                                                borderRadius: "2px",
                                                position: "relative"
                                            }}>
                                                <div
                                                    style={{
                                                        position: "absolute", left: `${start}%`, width: `${end - start}%`, height: "100%",
                                                        background: isSelected ? "rgba(99, 102, 241, 0.5)" : layerConfig[layer].color,
                                                        borderLeft: isSelected ? "2px solid #facc15" : "none",
                                                        borderRadius: "2px", overflow: "hidden", cursor: "pointer",
                                                        display: "flex", alignItems: "center", padding: "0 5px", fontSize: "8px", color: "white"
                                                    }}
                                                    onClick={(e) => { e.stopPropagation(); setSelectedPropId(prop.id); }}
                                                >
                                                    {/* Keyframe Markers */}
                                                    {prop.keyframes?.map((kf, ki) => (
                                                        <div key={ki} style={{
                                                            position: "absolute",
                                                            left: `${((kf.time - prop.enterTime) / (duration - prop.enterTime)) * 100}%`,
                                                            width: "4px", height: "4px", background: "#facc15", borderRadius: "50%",
                                                            top: "50%", transform: "translateY(-50%)",
                                                            boxShadow: "0 0 4px rgba(250, 204, 21, 0.8)",
                                                            zIndex: 2
                                                        }} />
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}


                    {/* Playhead */}
                    <div style={{ position: "absolute", top: 0, bottom: 0, left: `${currentPercent}%`, width: "2px", background: "var(--text-accent)", pointerEvents: "none", zIndex: 10 }}>
                        <div style={{ width: "8px", height: "8px", background: "var(--text-accent)", position: "absolute", top: -4, left: -3, borderRadius: "50%" }} />
                    </div>
                </div>
            </div>
        </div>
    );
}
