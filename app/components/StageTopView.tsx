"use client";
import { useState, useRef, useEffect } from "react";
import { useScene } from "../context/SceneContext";
import type { StageProp } from "../types/scene";

export default function StageTopView() {
  const { scene, getVisibleProps, getAssetById, updateProp } = useScene();
  const visibleProps = getVisibleProps();
  const [selectedProp, setSelectedProp] = useState<string | null>(null);
  const [hoveredProp, setHoveredProp] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Convert stage coords to percentage positions
  const stageW = scene.meta.stageWidth;
  const stageD = scene.meta.stageDepth;

  const toPercent = (x: number, z: number) => ({
    left: 50 + (x / stageW) * 70,  // 70% of width used for stage area
    top: 15 + ((z + stageD / 2) / stageD) * 65, // z maps to vertical
  });

  const handlePointerDown = (e: React.PointerEvent, propId: string) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setSelectedProp(propId);
    setDraggingId(propId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingId || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const leftPercent = ((e.clientX - rect.left) / rect.width) * 100;
    const topPercent = ((e.clientY - rect.top) / rect.height) * 100;

    // Convert back from percent to stage coords
    const x = ((leftPercent - 50) / 70) * stageW;
    const z = ((topPercent - 15) / 65) * stageD - stageD / 2;

    const prop = visibleProps.find(p => p.id === draggingId);
    if (prop) {
      updateProp(draggingId, { position: { ...prop.position, x, z } });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (draggingId) {
      e.currentTarget.releasePointerCapture(e.pointerId);
      setDraggingId(null);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>, prop: StageProp) => {
    e.stopPropagation();
    const delta = e.deltaY > 0 ? -1 : 1;

    if (e.shiftKey) {
      // Rotation
      const currentRot = prop.rotation.y;
      const newRot = (currentRot + delta * 5) % 360;
      updateProp(prop.id, { rotation: { ...prop.rotation, y: newRot } });
    } else {
      // Scale
      const scaleStep = e.deltaY > 0 ? -0.1 : 0.1;
      const currentScale = prop.scale.x;
      const newScale = Math.max(0.1, Math.min(10, currentScale + scaleStep));
      updateProp(prop.id, { scale: { x: newScale, y: newScale, z: newScale } });
    }
  };

  return (
    <div className="panel" style={{ height: "100%" }}>
      <div className="panel-header">
        <h3>
          <span className="icon">📐</span>
          Stage Top View
          {visibleProps.length > 0 && (
            <span style={{
              fontSize: "9px",
              background: "rgba(99, 102, 241, 0.15)",
              color: "var(--text-accent)",
              padding: "1px 6px",
              borderRadius: "10px",
              fontWeight: 500,
            }}>
              {visibleProps.length}
            </span>
          )}
        </h3>
        <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
          <span style={{ fontSize: "9px", color: "var(--text-muted)" }}>Drag to move · Scroll to scale · Shift+Scroll to rotate</span>
        </div>
      </div>
      <div className="panel-body" style={{ padding: 0, userSelect: "none" }}>
        <div
          className="grid-canvas"
          style={{ position: "relative", height: "100%", touchAction: "none" }}
          ref={canvasRef}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          {/* Center crosshairs */}
          <div style={{
            position: "absolute", left: "50%", top: 0, bottom: 0, width: "1px",
            background: "rgba(99, 102, 241, 0.08)", pointerEvents: "none",
          }} />
          <div style={{
            position: "absolute", top: "48%", left: 0, right: 0, height: "1px",
            background: "rgba(99, 102, 241, 0.08)", pointerEvents: "none",
          }} />

          {/* Stage outline */}
          <div style={{
            position: "absolute",
            left: `${50 - 35}%`, top: "15%",
            width: "70%", height: "65%",
            border: "1px dashed rgba(99, 102, 241, 0.2)",
            borderRadius: "4px",
            pointerEvents: "none",
          }}>
            <span style={{
              position: "absolute", top: "-16px", left: "50%", transform: "translateX(-50%)",
              fontSize: "8px", fontWeight: 600, letterSpacing: "0.1em",
              color: "rgba(99, 102, 241, 0.4)", textTransform: "uppercase",
            }}>
              Stage Area ({stageW}m × {stageD}m)
            </span>
          </div>

          {/* Audience direction indicator */}
          <div style={{
            position: "absolute", bottom: "4%", left: "50%", transform: "translateX(-50%)",
            fontSize: "8px", color: "var(--text-muted)", letterSpacing: "0.08em",
            display: "flex", alignItems: "center", gap: "4px",
          }}>
            <span style={{ fontSize: "10px" }}>↓</span> AUDIENCE
          </div>

          {/* Upstage indicator */}
          <div style={{
            position: "absolute", top: "4%", left: "50%", transform: "translateX(-50%)",
            fontSize: "8px", color: "var(--text-muted)", letterSpacing: "0.08em",
            display: "flex", alignItems: "center", gap: "4px",
          }}>
            UPSTAGE <span style={{ fontSize: "10px" }}>↑</span>
          </div>

          {/* Prop nodes — numbered circles */}
          {visibleProps.map((prop, index) => {
            const pos = toPercent(prop.position.x, prop.position.z);
            const asset = getAssetById(prop.assetId);
            const isSelected = selectedProp === prop.id;
            const isHovered = hoveredProp === prop.id;
            const isDragging = draggingId === prop.id;
            const nodeColor = getNodeColor(prop.layer);

            // scale base node size visually between 0.5x and 2x
            const displayScale = Math.max(0.5, Math.min(2, prop.scale.x));
            const nodeSize = (isSelected || isHovered ? 26 : 22) * displayScale;

            return (
              <div key={prop.id} style={{ zIndex: isSelected || isHovered || isDragging ? 10 : 2 }}>
                {/* Node */}
                <div
                  onPointerDown={(e) => handlePointerDown(e, prop.id)}
                  onMouseEnter={() => setHoveredProp(prop.id)}
                  onMouseLeave={() => setHoveredProp(null)}
                  onWheel={(e) => handleWheel(e, prop)}
                  style={{
                    position: "absolute",
                    left: `${pos.left}%`,
                    top: `${pos.top}%`,
                    transform: `translate(-50%, -50%) rotate(${prop.rotation.y}deg)`,
                    width: `${nodeSize}px`,
                    height: `${nodeSize}px`,
                    borderRadius: "50%",
                    background: isSelected ? nodeColor : `${nodeColor}44`,
                    border: `2px solid ${nodeColor}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: `${9 * displayScale}px`,
                    fontWeight: 700,
                    color: isSelected ? "#fff" : nodeColor,
                    cursor: isDragging ? "grabbing" : "grab",
                    transition: isDragging ? "none" : "all 0.15s ease",
                    boxShadow: isSelected || isDragging ? `0 0 12px ${nodeColor}88` : isHovered ? `0 0 8px ${nodeColor}44` : "none",
                  }}
                >
                  {index + 1}
                  {/* Direction indicator for rotation */}
                  <div style={{
                    position: "absolute", top: "-4px", left: "50%", transform: "translateX(-50%)",
                    width: "4px", height: "4px", background: nodeColor, borderRadius: "50%"
                  }} />
                </div>

                {/* Tooltip on hover */}
                {(isHovered || isSelected) && !isDragging && (
                  <div style={{
                    position: "absolute",
                    left: `${pos.left}%`,
                    top: `calc(${pos.top}% - ${nodeSize / 2 + 5}px)`,
                    transform: "translate(-50%, -100%)",
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border-primary)",
                    borderRadius: "var(--radius-sm)",
                    padding: "4px 8px",
                    fontSize: "9px",
                    color: "var(--text-primary)",
                    whiteSpace: "nowrap",
                    zIndex: 20,
                    pointerEvents: "none",
                    boxShadow: "var(--shadow-md)",
                  }}>
                    <div style={{ fontWeight: 600, color: nodeColor }}>
                      #{index + 1} {prop.label}
                    </div>
                    <div style={{ color: "var(--text-muted)", fontSize: "8px", marginTop: "1px" }}>
                      {asset?.name || prop.assetId} · Scale: {prop.scale.x.toFixed(1)}x · Rot: {prop.rotation.y.toFixed(0)}°
                    </div>
                    <div style={{ color: "var(--text-muted)", fontSize: "8px" }}>
                      Pos: ({prop.position.x.toFixed(1)}, {prop.position.z.toFixed(1)})
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Empty state */}
          {visibleProps.length === 0 && (
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--text-muted)", fontSize: "10px", pointerEvents: "none",
              flexDirection: "column", gap: "8px"
            }}>
              <div className="empty-icon" style={{ fontSize: "24px", color: "rgba(255,255,255,0.1)" }}>📐</div>
              <p style={{ textAlign: "center", color: "rgba(255,255,255,0.3)" }}>No props on stage yet.<br />Use AI Director to generate a layout.</p>
            </div>
          )}

          {/* Scale indicator */}
          <div style={{
            position: "absolute", bottom: "6px", right: "8px",
            display: "flex", alignItems: "center", gap: "4px",
            pointerEvents: "none"
          }}>
            <div style={{ width: "30px", height: "1px", background: "var(--text-muted)" }} />
            <span style={{ fontSize: "8px", color: "var(--text-muted)" }}>5m</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function getNodeColor(layer: string): string {
  switch (layer) {
    case "props": return "#6366f1";
    case "lighting": return "#8b5cf6";
    case "audio": return "#f59e0b";
    case "screens": return "#3b82f6";
    case "structure": return "#6b7280";
    case "decor": return "#ec4899";
    default: return "#22c55e";
  }
}
