"use client";

import React from "react";
import Link from "next/link";

export default function CrowdSimulationPage() {
    return (
        <div style={{
            display: "flex",
            flexDirection: "column",
            height: "100vh",
            width: "100vw",
            overflow: "hidden",
            background: "#08080e"
        }}>
            <header style={{
                height: "46px",
                background: "#0e0e18",
                borderBottom: "1px solid #1e1e30",
                display: "flex",
                alignItems: "center",
                padding: "0 16px",
                flexShrink: 0
            }}>
                <Link
                    href="/"
                    style={{
                        color: "#e8ff47",
                        textDecoration: "none",
                        fontFamily: "'DM Mono', monospace",
                        fontSize: "11px",
                        letterSpacing: "0.1em",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        background: "rgba(255,255,255,0.05)",
                        padding: "4px 10px",
                        borderRadius: "2px",
                        border: "1px solid #1e1e30"
                    }}
                >
                    ← RETURN TO FORGE
                </Link>
                <div style={{ marginLeft: "20px", color: "#44445a", fontSize: "10px", fontFamily: "'DM Mono', monospace" }}>
                    FULL SCREEN SIMULATION MODE
                </div>
            </header>

            <iframe
                src="/crowd-sim.html"
                style={{
                    flex: 1,
                    border: "none",
                    width: "100%",
                    height: "100%"
                }}
                title="Crowd Simulation"
            />
        </div>
    );
}
