"use client";

import { useState } from "react";
import { SceneProvider, useScene } from "./context/SceneContext";
import StageTopView from "./components/StageTopView";
import Viewport3D from "./components/Viewport3D";
import CrowdAreaView from "./components/CrowdAreaView";
import Timeline from "./components/Timeline";
import AssetLibrary from "./components/AssetLibrary";
import AIChat from "./components/AIChat";

function AppContent() {
  const [activeTab, setActiveTab] = useState("design");
  const [rightPanelMode, setRightPanelMode] = useState<"assets" | "chat">("chat");
  const { scene, clearProps } = useScene();

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
        <div className="logo">⬡ StageForge</div>

        <div style={{ width: "1px", height: "18px", background: "var(--border-primary)" }} />

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

        <div className="topbar-actions">
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
        {/* Left + Center Area */}
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

          {/* Bottom Row: Crowd Area + Timeline */}
          <div style={{
            flex: 0.75,
            display: "flex",
            gap: "3px",
            minHeight: 0,
          }}>
            {/* Crowd Area View */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <CrowdAreaView />
            </div>

            {/* Timeline */}
            <div style={{ flex: 1.4, minWidth: 0 }}>
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
          <span>v0.2.0</span>
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
