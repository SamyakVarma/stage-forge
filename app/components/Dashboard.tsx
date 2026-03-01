"use client";

import React, { useState } from "react";
import { SceneState } from "../types/scene";

interface DashboardProps {
    projects: SceneState[];
    onCreateProject: (name: string, width: number, depth: number) => void;
    onOpenProject: (id: string) => void;
    onDeleteProject: (id: string) => void;
}

export default function Dashboard({ projects, onCreateProject, onOpenProject, onDeleteProject }: DashboardProps) {
    const [mousePos, setMousePos] = useState({ x: 50, y: 50 });
    const [showModal, setShowModal] = useState(false);
    const [newName, setNewName] = useState("New Spectacular Event");
    const [newWidth, setNewWidth] = useState(24);
    const [newDepth, setNewDepth] = useState(16);

    const handleMouseMove = (e: React.MouseEvent) => {
        setMousePos({
            x: (e.clientX / window.innerWidth) * 100,
            y: (e.clientY / window.innerHeight) * 100
        });
    };

    return (
        <div className="dashboard-root" onMouseMove={handleMouseMove} style={{
            minHeight: "100vh",
            width: "100vw",
            background: "#020205",
            color: "#fff",
            fontFamily: "'Barlow', sans-serif",
            overflowX: "hidden",
            position: "relative"
        }}>
            {/* Stage Design Interactive Background */}
            <div className="stage-bg-system">
                <div className="tech-grid" />
                <div className="nebula-bg" />
                <div className="interactive-spotlight" style={{
                    background: `radial-gradient(circle at ${mousePos.x}% ${mousePos.y}%, rgba(99, 102, 241, 0.15) 0%, transparent 60%)`
                }} />

                {/* Moving Beams / Lasers */}
                <div className="beam beam-1" style={{ transform: `rotate(${15 + (mousePos.x * 0.1)}deg)` }} />
                <div className="beam beam-2" style={{ transform: `rotate(${-20 - (mousePos.y * 0.1)}deg)` }} />

                {/* Atmosphere Particles */}
                <div className="dust-layer" />
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes float {
                    0% { transform: translate(0, 0) scale(1); }
                    50% { transform: translate(2%, 4%) scale(1.05); }
                    100% { transform: translate(0, 0) scale(1); }
                }

                @keyframes drift {
                    from { background-position: 0 0; }
                    to { background-position: 1000px 1000px; }
                }

                .stage-bg-system {
                    position: fixed; inset: 0; z-index: 0; overflow: hidden;
                    pointer-events: none;
                }

                .tech-grid {
                    position: absolute; inset: 0;
                    background-image: 
                        linear-gradient(rgba(99, 102, 241, 0.05) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(99, 102, 241, 0.05) 1px, transparent 1px);
                    background-size: 60px 60px;
                    opacity: 0.6;
                }

                .nebula-bg {
                    position: absolute; inset: 0;
                    background: 
                        radial-gradient(circle at 15% 25%, rgba(99, 102, 241, 0.15) 0%, transparent 45%),
                        radial-gradient(circle at 85% 75%, rgba(232, 255, 71, 0.1) 0%, transparent 45%);
                    filter: blur(80px);
                    animation: float 20s infinite ease-in-out;
                }

                .interactive-spotlight {
                    position: absolute; inset: 0; z-index: 1;
                    transition: background 0.15s ease-out;
                }

                .beam {
                    position: absolute; top: -50%;
                    width: 300px; height: 200%;
                    background: linear-gradient(to bottom, transparent, rgba(99, 102, 241, 0.08), transparent);
                    filter: blur(50px);
                    transform-origin: center center;
                }
                .beam-1 { left: 15%; opacity: 0.7; }
                .beam-2 { left: 75%; opacity: 0.5; }

                .dust-layer {
                    position: absolute; inset: 0;
                    background: transparent url('https://www.transparenttextures.com/patterns/stardust.png');
                    opacity: 0.08;
                    animation: drift 120s linear infinite;
                }

                .dashboard-content {
                    position: relative;
                    z-index: 10;
                    max-width: 1400px;
                    margin: 0 auto;
                    padding: 60px 40px;
                }

                .dashboard-header { 
                    margin-bottom: 60px; 
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-end;
                }
                
                .logo-section h1 { 
                    font-family: 'Bebas Neue'; 
                    font-size: 72px; 
                    background: linear-gradient(135deg, #fff 0%, #a5a5e0 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    margin: 0; 
                    letter-spacing: 0.05em; 
                    line-height: 0.9;
                }
                
                .logo-section p { 
                    font-family: 'DM Mono'; 
                    font-size: 12px; 
                    color: #6366f1; 
                    letter-spacing: 0.4em; 
                    margin-top: 10px;
                    font-weight: 500;
                }

                .stats-badge {
                    background: rgba(255,255,255,0.03);
                    border: 1px solid rgba(255,255,255,0.05);
                    padding: 8px 16px;
                    border-radius: 100px;
                    font-size: 11px;
                    font-family: 'DM Mono';
                    color: #888;
                }

                .project-grid { 
                    display: grid; 
                    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); 
                    gap: 30px; 
                }

                .card-base {
                    background: rgba(15, 15, 25, 0.4);
                    backdrop-filter: blur(12px);
                    border: 1px solid rgba(255,255,255,0.08);
                    border-radius: 16px;
                    padding: 30px;
                    transition: all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1);
                    position: relative;
                    overflow: hidden;
                }

                .project-card { cursor: pointer; }
                
                .project-card:hover { 
                    border-color: rgba(99, 102, 241, 0.4);
                    transform: translateY(-8px);
                    background: rgba(20, 20, 35, 0.6);
                    box-shadow: 0 20px 40px rgba(0,0,0,0.4), 0 0 20px rgba(99, 102, 241, 0.1);
                }

                .project-card::before {
                    content: '';
                    position: absolute;
                    top: 0; left: 0; width: 100%; height: 2px;
                    background: linear-gradient(90deg, transparent, #6366f1, transparent);
                    transform: translateX(-100%);
                    transition: 0.6s;
                }
                .project-card:hover::before { transform: translateX(100%); }

                .project-card h3 { 
                    font-family: 'Barlow'; 
                    font-size: 24px; 
                    font-weight: 700;
                    margin: 0 0 10px 0;
                    color: #fff;
                }

                .project-card .meta { 
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .meta-item {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 12px;
                    color: #777;
                }

                .meta-item .icon { font-size: 14px; color: #6366f1; opacity: 0.6; }

                .delete-btn { 
                    position: absolute; top: 20px; right: 20px; 
                    width: 32px; height: 32px;
                    display: flex; align-items: center; justify-content: center;
                    background: rgba(255,50,50,0.05); 
                    color: #f44; 
                    border: 1px solid rgba(255,50,50,0.1); 
                    border-radius: 8px;
                    font-size: 14px; 
                    opacity: 0; 
                    transition: 0.3s;
                    z-index: 2;
                }
                .project-card:hover .delete-btn { opacity: 0.6; }
                .delete-btn:hover { opacity: 1 !important; background: #f33; color: #fff; }

                .create-card { 
                    display: flex; 
                    flex-direction: column;
                    align-items: center; 
                    justify-content: center; 
                    border: 2px dashed rgba(255,255,255,0.05);
                    color: #888;
                    gap: 15px;
                }

                .create-card:hover { 
                    border-color: #e8ff47;
                    color: #fff;
                    background: rgba(232,255,71,0.05);
                }

                .create-icon {
                    width: 50px;
                    height: 50px;
                    border-radius: 50%;
                    background: rgba(255,255,255,0.03);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 24px;
                    transition: 0.3s;
                }
                .create-card:hover .create-icon { transform: rotate(90deg); background: #e8ff47; color: #000; }

                .modal-overlay { 
                    position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(12px); 
                    display: flex; align-items: center; justify-content: center; z-index: 1000;
                    animation: fadeIn 0.3s forwards;
                }

                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

                .modal { 
                    background: #0a0a10; 
                    border: 1px solid rgba(232,255,71,0.2); 
                    padding: 40px; 
                    border-radius: 24px; 
                    width: 480px;
                    box-shadow: 0 40px 100px rgba(0,0,0,0.8);
                }

                .modal h2 { font-family: 'Bebas Neue'; font-size: 42px; color: #e8ff47; margin: 0 0 30px 0; letter-spacing: 0.05em; }
                
                .modal-field { margin-bottom: 20px; }
                .modal-field label { display: block; font-family: 'DM Mono'; font-size: 10px; color: #6366f1; margin-bottom: 8px; text-transform: uppercase; font-weight: 600; }
                .modal-field input { 
                    width: 100%; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); color: #fff; 
                    padding: 12px 16px; border-radius: 12px; font-family: 'Barlow'; font-size: 16px; outline: none;
                    transition: 0.2s;
                }
                .modal-field input:focus { border-color: #6366f1; background: rgba(255,255,255,0.05); }

                .modal-footer { display: flex; gap: 15px; margin-top: 40px; }
                .btn { 
                    padding: 14px; 
                    border-radius: 12px; 
                    font-weight: 600; 
                    cursor: pointer; 
                    transition: 0.3s; 
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .btn-cancel { flex: 1; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); color: #888; font-family: 'DM Mono'; font-size: 12px; }
                .btn-cancel:hover { background: rgba(255,255,255,0.08); color: #fff; }
                
                .btn-create { flex: 2; background: #e8ff47; border: none; color: #000; font-family: 'Bebas Neue'; font-size: 22px; }
                .btn-create:hover { background: #d8ef37; transform: translateY(-2px); box-shadow: 0 10px 20px rgba(232, 255, 71, 0.2); }
                `
            }} />

            <div className="dashboard-content">
                <header className="dashboard-header">
                    <div className="logo-section">
                        <h1>STAGEFORGE</h1>
                        <p>PRO AUDIO & VISUAL DESIGN ENGINE</p>
                    </div>
                    <div className="stats-badge">
                        {projects.length} ACTIVE {projects.length === 1 ? 'PRODUCTION' : 'PRODUCTIONS'}
                    </div>
                </header>

                <div className="project-grid">
                    <div className="card-base create-card" onClick={() => setShowModal(true)}>
                        <div className="create-icon">+</div>
                        <div style={{ fontFamily: 'Bebas Neue', fontSize: '24px', letterSpacing: '0.1em' }}>CREATE NEW WORKSPACE</div>
                    </div>

                    {projects.map(p => (
                        <div key={p.id} className="card-base project-card" onClick={() => onOpenProject(p.id)}>
                            <button className="delete-btn" title="Delete Project" onClick={(e) => { e.stopPropagation(); onDeleteProject(p.id); }}>✕</button>
                            <div style={{ fontSize: '12px', color: '#6366f1', marginBottom: '10px', fontWeight: 600, fontFamily: 'DM Mono' }}>PROJECT_{p.id.slice(-4).toUpperCase()}</div>
                            <h3>{p.meta.name}</h3>
                            <div className="meta">
                                <div className="meta-item">
                                    <span className="icon">📐</span>
                                    {p.meta.stageWidth}m × {p.meta.stageDepth}m Stage
                                </div>
                                <div className="meta-item">
                                    <span className="icon">📦</span>
                                    {p.props.length} Components Placed
                                </div>
                                <div className="meta-item">
                                    <span className="icon">🕒</span>
                                    {p.meta.duration}s Duration
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {showModal && (
                <div className="modal-overlay">
                    <div className="modal">
                        <h2>NEW PRODUCTION</h2>
                        <div className="modal-field">
                            <label>WORKSPACE NAME</label>
                            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Summer Festival Mainstage" />
                        </div>
                        <div style={{ display: "flex", gap: "20px" }}>
                            <div className="modal-field" style={{ flex: 1 }}>
                                <label>WIDTH (M)</label>
                                <input type="number" value={newWidth} onChange={e => setNewWidth(Number(e.target.value))} />
                            </div>
                            <div className="modal-field" style={{ flex: 1 }}>
                                <label>DEPTH (M)</label>
                                <input type="number" value={newDepth} onChange={e => setNewDepth(Number(e.target.value))} />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-cancel" onClick={() => setShowModal(false)}>CANCEL</button>
                            <button className="btn btn-create" onClick={() => { onCreateProject(newName, newWidth, newDepth); setShowModal(false); }}>INITIALIZE HUB</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
