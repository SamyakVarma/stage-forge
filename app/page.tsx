"use client";

import { useState } from "react";
import { SceneProvider, useScene } from "./context/SceneContext";
import StageTopView from "./components/StageTopView";
import Viewport3D from "./components/Viewport3D";
import Timeline from "./components/Timeline";
import AssetLibrary from "./components/AssetLibrary";
import AIChat from "./components/AIChat";
import Dashboard from "./components/Dashboard";

function AppContent() {
  const [activeTab, setActiveTab] = useState("design");
  const [rightPanelMode, setRightPanelMode] = useState<"assets" | "chat">("chat");
  const {
    scene, projects, createNewProject, openProject, deleteProject, closeProject,
    updateMeta, clearProps
  } = useScene();

  if (!scene) {
    return (
      <Dashboard
        projects={projects}
        onCreateProject={createNewProject}
        onOpenProject={openProject}
        onDeleteProject={deleteProject}
      />
    );
  }

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      width: "100vw",
      overflow: "hidden",
      background: "var(--bg-primary)",
    }}>
      {/* Top Bar */}
      <div className="topbar">
        <button className="btn btn-ghost" onClick={closeProject} style={{ fontSize: "14px", marginRight: "10px" }}>
          🏠 HOME
        </button>
        <div className="logo" style={{ color: "#e8ff47", fontSize: "18px" }}>⬡ {scene.meta.name}</div>

        <div style={{ width: "1px", height: "18px", background: "var(--border-primary)", margin: "0 15px" }} />

        <div className="nav-tabs">
          {[
            { id: "design", label: "Design" },
            { id: "simulate", label: "Simulate" },
            { id: "manage", label: "Manage" },
            { id: "export", label: "Export" },
          ].map((tab) => (
            <button
              key={tab.id}
              className={`nav-tab ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="topbar-actions" style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "9px", color: "var(--text-muted)", fontFamily: "'DM Mono'" }}>GLOBAL ILLUM</span>
            <input
              type="range" min="0" max="1" step="0.05"
              value={scene.meta.globalIllumination}
              onChange={(e) => updateMeta({ globalIllumination: parseFloat(e.target.value) })}
              style={{ width: "80px", accentColor: "#e8ff47" }}
            />
          </div>
          <button className="btn btn-ghost" style={{ fontSize: "10px" }}>↩ Undo</button>
          <button className="btn btn-ghost" style={{ fontSize: "10px" }}>↪ Redo</button>
          {scene.props.length > 0 && (
            <>
              <div style={{ width: "1px", height: "14px", background: "var(--border-primary)", margin: "0 4px" }} />
              <button
                className="btn btn-ghost"
                onClick={clearProps}
                style={{ fontSize: "10px", color: "var(--danger)" }}
              >
                🗑 Clear Scene
              </button>
            </>
          )}
          <div style={{ width: "1px", height: "14px", background: "var(--border-primary)", margin: "0 4px" }} />
          <button className="btn btn-primary" style={{ fontSize: "10px", padding: "4px 12px" }}>
            💾 Save
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{
        flex: 1,
        display: "flex",
        overflow: "hidden",
        gap: "3px",
        padding: "3px",
        minHeight: 0,
      }}>
        {activeTab === "design" ? (
          <>
            {/* Left + Center Area (Design) */}
            <div style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: "3px",
              minWidth: 0,
            }}>
              {/* Top Row: Stage Top View + 3D Viewport */}
              <div style={{
                flex: 1,
                display: "flex",
                gap: "3px",
                minHeight: 0,
              }}>
                {/* Stage Top View */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <StageTopView />
                </div>

                {/* 3D Viewport / 2D Front View */}
                <div style={{ flex: 1.4, minWidth: 0 }}>
                  <Viewport3D />
                </div>
              </div>

              {/* Bottom Row: Timeline (Full width) */}
              <div style={{
                flex: 0.75,
                display: "flex",
                gap: "3px",
                minHeight: 0,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Timeline />
                </div>
              </div>
            </div>

            {/* Right Panel: Asset Library + AI Chat */}
            <div style={{
              width: "340px",
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              gap: "3px",
            }}>
              {/* Right panel toggle */}
              <div style={{
                display: "flex",
                background: "var(--bg-panel)",
                borderRadius: "var(--radius-lg)",
                border: "1px solid var(--border-primary)",
                overflow: "hidden",
              }}>
                <button
                  className={`nav-tab ${rightPanelMode === "assets" ? "active" : ""}`}
                  style={{ flex: 1, borderRadius: 0, textAlign: "center" }}
                  onClick={() => setRightPanelMode("assets")}
                >
                  📦 Assets ({scene.assets.length})
                </button>
                <button
                  className={`nav-tab ${rightPanelMode === "chat" ? "active" : ""}`}
                  style={{ flex: 1, borderRadius: 0, textAlign: "center" }}
                  onClick={() => setRightPanelMode("chat")}
                >
                  🤖 AI Director
                </button>
              </div>

              {/* Panel content */}
              <div style={{ flex: 1, minHeight: 0 }}>
                {rightPanelMode === "assets" ? <AssetLibrary /> : <AIChat />}
              </div>
            </div>
          </>
        ) : activeTab === "simulate" ? (
          <div style={{ flex: 1, background: "#000", position: "relative" }}>
            <iframe
              src="/crowd-sim.html"
              style={{ width: "100%", height: "100%", border: "none" }}
              title="Crowd Simulation"
            />
          </div>
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
            {activeTab.toUpperCase()} View Coming Soon
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="status-bar">
        <div className="status-item">
          <div className="pulse-dot" />
          <span>Ready</span>
        </div>
        <div className="status-item">
          <span>🎯</span>
          <span>{scene.meta.name} — {scene.meta.venueType}</span>
        </div>
        <div className="status-item">
          <span>📐</span>
          <span>{scene.meta.stageWidth}m × {scene.meta.stageDepth}m</span>
        </div>
        <div className="status-item">
          <span>🎭</span>
          <span>{scene.props.length} props</span>
        </div>
        <div style={{ marginLeft: "auto" }} className="status-item">
          <span>⏱️</span>
          <span>{Math.floor(scene.meta.duration / 60)}:{String(scene.meta.duration % 60).padStart(2, "0")} duration</span>
        </div>
        <div className="status-item">
          <span>🔧</span>
          <span>v0.3.0</span>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <SceneProvider>
      <AppContent />
    </SceneProvider>
  );
}
