"use client";
/* eslint-disable @next/next/no-img-element */
import { useState, useRef } from "react";
import { useScene } from "../context/SceneContext";
import type { StageAsset, StageProp } from "../types/scene";

const categories = [
    { id: "all", label: "All" },
    { id: "lighting", label: "Lighting" },
    { id: "audio", label: "Audio" },
    { id: "screens", label: "Screens" },
    { id: "structure", label: "Structure" },
    { id: "props", label: "Props" },
    { id: "decor", label: "Decor" },
];

export default function AssetLibrary() {
    const { scene, assets, addAsset, addProp, updateAsset, updateProp } = useScene();
    const [activeCategory, setActiveCategory] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");

    // Generation state
    const [showGenerate, setShowGenerate] = useState(false);
    const [generatePrompt, setGeneratePrompt] = useState("");
    const [generateName, setGenerateName] = useState("");
    const [generateCategory, setGenerateCategory] = useState("decor");
    const [isGenerating, setIsGenerating] = useState(false);
    const [generateError, setGenerateError] = useState<string | null>(null);

    // Edit State
    const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    if (!scene) return null;

    const editingAsset = assets.find(a => a.id === editingAssetId);
    const selectedProp = scene.props.find(p => p.id === scene.selectedPropId);
    const selectedAsset = selectedProp ? assets.find(a => a.id === selectedProp.assetId) : null;

    const filteredAssets = assets.filter((asset) => {
        const matchesCategory = activeCategory === "all" || asset.category === activeCategory;
        const matchesSearch = asset.name.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    const handleGenerate = async () => {
        if (!generatePrompt.trim() || !generateName.trim()) return;
        setIsGenerating(true);
        setGenerateError(null);

        try {
            const res = await fetch("/api/generate-prop", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt: generatePrompt, name: generateName, category: generateCategory }),
            });
            const data = await res.json();
            if (data.success && data.asset) {
                const assetWithFolder = {
                    ...data.asset,
                    assetFolder: `/assets/${data.asset.id}`
                };
                addAsset(assetWithFolder as StageAsset);
                setGeneratePrompt("");
                setGenerateName("");
                setShowGenerate(false);
            } else {
                setGenerateError(data.error || "Failed to generate prop");
            }
        } catch (err) {
            setGenerateError(`Network error: ${err instanceof Error ? err.message : "Unknown"}`);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: "image" | "model") => {
        const file = e.target.files?.[0];
        if (!file || !editingAssetId) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append("file", file);
        formData.append("assetId", editingAssetId);
        formData.append("type", type);

        try {
            const res = await fetch("/api/upload-asset", {
                method: "POST",
                body: formData,
            });
            const data = await res.json();
            if (data.success) {
                const updates: Partial<StageAsset> = type === "image"
                    ? { imageUrl: data.url, assetFolder: `/assets/${editingAssetId}` }
                    : { modelUrl: data.url, assetFolder: `/assets/${editingAssetId}` };
                updateAsset(editingAssetId, updates);
            }
        } catch (err) {
            console.error("Upload failed", err);
        } finally {
            setIsUploading(false);
        }
    };

    const handleAddInstance = (asset: StageAsset) => {
        const newInstanceId = `prop-${Date.now()}`;
        const newProp: StageProp = {
            id: newInstanceId,
            assetId: asset.id,
            label: `New ${asset.name}`,
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 },
            enterTime: 0,
            exitTime: -1,
            layer: asset.category,
            visible: true,
            keyframes: []
        };
        addProp(newProp);
    };

    const handleSaveEdit = (updates: Partial<StageAsset>) => {
        if (editingAssetId) {
            updateAsset(editingAssetId, updates);
        }
    };

    return (
        <div className="panel" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
            {/* Header stays consistent */}
            <div className="panel-header">
                <h3>
                    <span className="icon">{selectedProp ? "💎" : editingAssetId ? "🔧" : "📦"}</span>
                    {selectedProp ? "Prop Controls" : editingAssetId ? "Asset Editor" : "Asset Library"}
                </h3>
                {editingAssetId ? (
                    <button className="btn btn-ghost" onClick={() => setEditingAssetId(null)} style={{ fontSize: "12px" }}>← Back</button>
                ) : selectedProp ? (
                    <span style={{ fontSize: "10px", color: "var(--text-accent)" }}>Instance: {selectedProp.id}</span>
                ) : (
                    <span style={{ fontSize: "9px", color: "var(--text-muted)" }}>{filteredAssets.length} items</span>
                )}
            </div>

            <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
                {selectedProp ? (
                    /** --- INDIVIDUAL PROP TWEAKING --- **/
                    <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
                        <div style={{ fontWeight: 600, fontSize: "12px", color: "var(--text-primary)" }}>{selectedProp.label}</div>

                        <div className="edit-section">
                            <label>Label</label>
                            <input className="input-field" value={selectedProp.label} onChange={(e) => updateProp(selectedProp.id, { label: e.target.value })} />
                        </div>

                        {(selectedAsset?.category === "screens") && (
                            <div style={{ background: "rgba(0,0,0,0.2)", padding: "10px", borderRadius: "8px", border: "1px solid #3b82f6" }}>
                                <label style={{ color: "#3b82f6", fontSize: "10px", textTransform: "uppercase" }}>Display Controls</label>

                                <div className="edit-section" style={{ marginTop: "8px" }}>
                                    <small style={{ fontSize: "9px" }}>Source URL (Image/Video MP4)</small>
                                    <input
                                        className="input-field"
                                        placeholder="https://..."
                                        value={selectedProp.imageUrl || ""}
                                        onChange={(e) => updateProp(selectedProp.id, { imageUrl: e.target.value })}
                                    />
                                </div>

                                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px", alignItems: "center" }}>
                                    <span style={{ fontSize: "11px" }}>Width</span>
                                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                        <input
                                            type="range" min="1" max="40" step="0.5"
                                            value={selectedProp.width || selectedAsset.width || 10}
                                            onChange={(e) => updateProp(selectedProp.id, { width: parseFloat(e.target.value) })}
                                        />
                                        <span style={{ fontSize: "11px", minWidth: "30px" }}>{(selectedProp.width || selectedAsset.width || 10).toFixed(1)}m</span>
                                    </div>
                                </div>

                                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px", alignItems: "center" }}>
                                    <span style={{ fontSize: "11px" }}>Height</span>
                                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                        <input
                                            type="range" min="1" max="20" step="0.5"
                                            value={selectedProp.height || selectedAsset.height || 6}
                                            onChange={(e) => updateProp(selectedProp.id, { height: parseFloat(e.target.value) })}
                                        />
                                        <span style={{ fontSize: "11px", minWidth: "30px" }}>{(selectedProp.height || selectedAsset.height || 6).toFixed(1)}m</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {(selectedAsset?.category === "structure" || selectedAsset?.modularWidth) && (
                            <div style={{ background: "rgba(0,0,0,0.2)", padding: "10px", borderRadius: "8px", border: "1px solid var(--border-primary)" }}>
                                <label style={{ fontSize: "10px", textTransform: "uppercase" }}>Structural Controls</label>
                                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px", alignItems: "center" }}>
                                    <span style={{ fontSize: "11px" }}>Total Length</span>
                                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                        <input
                                            type="range" min="0.5" max="30" step="0.1"
                                            value={selectedProp.scale.x * (selectedAsset.width || 1)}
                                            onChange={(e) => {
                                                const newW = parseFloat(e.target.value);
                                                const baseW = selectedAsset.width || 1;
                                                updateProp(selectedProp.id, { scale: { ...selectedProp.scale, x: newW / baseW } });
                                            }}
                                        />
                                        <span style={{ fontSize: "11px", minWidth: "30px" }}>{(selectedProp.scale.x * (selectedAsset.width || 1)).toFixed(1)}m</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {selectedAsset?.category === "lighting" && (
                            <div style={{ background: "rgba(0,0,0,0.2)", padding: "10px", borderRadius: "8px", border: "1px solid rgba(250, 204, 21, 0.2)" }}>
                                <label style={{ color: "#facc15", fontSize: "10px", textTransform: "uppercase" }}>Light Overwrites</label>

                                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px" }}>
                                    <span style={{ fontSize: "11px" }}>Intensity</span>
                                    <input type="range" min="0" max="10" step="0.1" value={selectedProp.lightPower ?? selectedAsset.lightPower ?? 2}
                                        onChange={(e) => updateProp(selectedProp.id, { lightPower: parseFloat(e.target.value) })} />
                                </div>

                                {selectedAsset.lightType !== "panel" && selectedAsset.lightType !== "diffuse" && (
                                    <>
                                        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px" }}>
                                            <span style={{ fontSize: "11px" }}>Beam Angle</span>
                                            <input type="range" min="0.1" max="1.5" step="0.05" value={selectedProp.lightAngle ?? selectedAsset.lightAngle ?? 0.4}
                                                onChange={(e) => updateProp(selectedProp.id, { lightAngle: parseFloat(e.target.value) })} />
                                        </div>
                                        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px" }}>
                                            <span style={{ fontSize: "11px" }}>Penumbra (Soft)</span>
                                            <input type="range" min="0" max="1" step="0.05" value={selectedProp.lightPenumbra ?? selectedAsset.lightPenumbra ?? 0.5}
                                                onChange={(e) => updateProp(selectedProp.id, { lightPenumbra: parseFloat(e.target.value) })} />
                                        </div>
                                    </>
                                )}



                                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px" }}>
                                    <span style={{ fontSize: "11px" }}>Color</span>
                                    <input type="color" value={selectedProp.lightColor ?? selectedAsset.lightColor ?? "#ffffff"}
                                        onChange={(e) => updateProp(selectedProp.id, { lightColor: e.target.value })} />
                                </div>
                            </div>
                        )}

                        <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "10px" }}>
                            * Transformation (X, Y, Z) and Keys can be handled via Timeline and Viewport dragging.
                        </div>
                    </div>
                ) : editingAssetId && editingAsset ? (
                    /** --- MASTER ASSET EDITOR --- **/
                    <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div style={{ display: "flex", gap: "10px" }}>
                            <div style={{ width: "60px", height: "60px", background: "var(--bg-elevated)", border: "1px solid var(--border-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                {editingAsset.imageUrl ? <img src={editingAsset.imageUrl} alt="" style={{ maxWidth: "90%" }} /> : <span>{editingAsset.icon}</span>}
                            </div>
                            <div>
                                <input className="input-field" style={{ fontWeight: 600 }} value={editingAsset.name} onChange={(e) => handleSaveEdit({ name: e.target.value })} />
                                <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "4px" }}>{editingAsset.assetFolder || `/assets/${editingAsset.id}`}</div>
                            </div>
                        </div>

                        <div className="edit-section">
                            <label>Base Dimensions (Meters)</label>
                            <div style={{ display: "flex", gap: "5px" }}>
                                <div style={{ flex: 1 }}>
                                    <small style={{ fontSize: "8px" }}>Width</small>
                                    <input type="number" step="0.1" className="input-field" value={editingAsset.width || 0} onChange={e => handleSaveEdit({ width: parseFloat(e.target.value) })} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <small style={{ fontSize: "8px" }}>Height</small>
                                    <input type="number" step="0.1" className="input-field" value={editingAsset.height || 0} onChange={e => handleSaveEdit({ height: parseFloat(e.target.value) })} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <small style={{ fontSize: "8px" }}>Depth</small>
                                    <input type="number" step="0.1" className="input-field" value={editingAsset.depth || 0} onChange={e => handleSaveEdit({ depth: parseFloat(e.target.value) })} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <small style={{ fontSize: "8px" }}>Mod-Width</small>
                                    <input type="number" step="0.1" className="input-field" value={editingAsset.modularWidth || 0} onChange={e => handleSaveEdit({ modularWidth: parseFloat(e.target.value) })} />
                                </div>
                            </div>
                        </div>

                        {editingAsset.category === "lighting" && (
                            <>
                                <div className="edit-section">
                                    <label>Default Light Type</label>
                                    <select className="input-field" value={editingAsset.lightType || "spotlight"} onChange={(e) => handleSaveEdit({ lightType: e.target.value as any })}>
                                        <option value="spotlight">Spotlight</option>
                                        <option value="diffuse">Diffuse Wash</option>
                                        <option value="panel">Panel Light (Rect)</option>
                                    </select>
                                </div>
                                {editingAsset.lightType === "spotlight" && (
                                    <div className="edit-section">
                                        <div style={{ display: "flex", gap: "10px" }}>
                                            <div style={{ flex: 1 }}>
                                                <small style={{ fontSize: "9px" }}>Default Angle</small>
                                                <input type="number" step="0.05" className="input-field" value={editingAsset.lightAngle ?? 0.4} onChange={e => handleSaveEdit({ lightAngle: parseFloat(e.target.value) })} />
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <small style={{ fontSize: "9px" }}>Default Softness</small>
                                                <input type="number" step="0.05" className="input-field" value={editingAsset.lightPenumbra ?? 0.5} onChange={e => handleSaveEdit({ lightPenumbra: parseFloat(e.target.value) })} />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}


                        {editingAsset.modelUrl && (
                            <div className="edit-section" style={{ background: "rgba(0,0,0,0.15)", padding: "10px", borderRadius: "8px", border: "1px solid var(--border-primary)" }}>
                                <label style={{ fontSize: "10px", textTransform: "uppercase", color: "var(--text-accent)" }}>3D Model Fixes (Origin/Rotation)</label>

                                <div style={{ marginTop: "8px" }}>
                                    <small style={{ fontSize: "9px", color: "var(--text-muted)" }}>Offset (X, Y, Z)</small>
                                    <div style={{ display: "flex", gap: "5px" }}>
                                        <input type="number" step="0.05" className="input-field" placeholder="X" value={editingAsset.modelOffset?.x || 0} onChange={e => handleSaveEdit({ modelOffset: { ...(editingAsset.modelOffset || { x: 0, y: 0, z: 0 }), x: parseFloat(e.target.value) } })} />
                                        <input type="number" step="0.05" className="input-field" placeholder="Y" value={editingAsset.modelOffset?.y || 0} onChange={e => handleSaveEdit({ modelOffset: { ...(editingAsset.modelOffset || { x: 0, y: 0, z: 0 }), y: parseFloat(e.target.value) } })} />
                                        <input type="number" step="0.05" className="input-field" placeholder="Z" value={editingAsset.modelOffset?.z || 0} onChange={e => handleSaveEdit({ modelOffset: { ...(editingAsset.modelOffset || { x: 0, y: 0, z: 0 }), z: parseFloat(e.target.value) } })} />
                                    </div>
                                </div>

                                <div style={{ marginTop: "8px" }}>
                                    <small style={{ fontSize: "9px", color: "var(--text-muted)" }}>Rotation Degrees (X, Y, Z)</small>
                                    <div style={{ display: "flex", gap: "5px" }}>
                                        <input type="number" step="1" className="input-field" placeholder="X" value={editingAsset.modelRotation?.x || 0} onChange={e => handleSaveEdit({ modelRotation: { ...(editingAsset.modelRotation || { x: 0, y: 0, z: 0 }), x: parseFloat(e.target.value) } })} />
                                        <input type="number" step="1" className="input-field" placeholder="Y" value={editingAsset.modelRotation?.y || 0} onChange={e => handleSaveEdit({ modelRotation: { ...(editingAsset.modelRotation || { x: 0, y: 0, z: 0 }), y: parseFloat(e.target.value) } })} />
                                        <input type="number" step="1" className="input-field" placeholder="Z" value={editingAsset.modelRotation?.z || 0} onChange={e => handleSaveEdit({ modelRotation: { ...(editingAsset.modelRotation || { x: 0, y: 0, z: 0 }), z: parseFloat(e.target.value) } })} />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="edit-section">
                            <label>Files & Models</label>
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                <div>
                                    <small style={{ fontSize: "9px", display: "block", marginBottom: "2px" }}>2D Image / SVG</small>
                                    <input type="file" accept="image/*,.svg" onChange={(e) => handleUpload(e, "image")} style={{ fontSize: "10px" }} />
                                    {editingAsset.imageUrl && <div style={{ fontSize: "8px", color: "var(--text-accent)", marginTop: "2px" }}>Active: {editingAsset.imageUrl}</div>}
                                </div>
                                <div>
                                    <small style={{ fontSize: "9px", display: "block", marginBottom: "2px" }}>3D Model (.glb/.gltf)</small>
                                    <input type="file" accept=".glb,.gltf" onChange={(e) => handleUpload(e, "model")} style={{ fontSize: "10px" }} />
                                    {editingAsset.modelUrl && <div style={{ fontSize: "8px", color: "var(--text-accent)", marginTop: "2px" }}>Active: {editingAsset.modelUrl}</div>}
                                </div>
                            </div>
                        </div>

                        {isUploading && <div style={{ fontSize: "10px", color: "var(--text-accent)", textAlign: "center" }}>Uploading file...</div>}

                        <button className="btn btn-primary" style={{ marginTop: "10px" }} onClick={() => handleAddInstance(editingAsset)}>+ Add to Scene</button>
                    </div>
                ) : (
                    /** --- ASSET LIST --- **/
                    <>
                        <div style={{ padding: "10px 12px 5px" }}>
                            <input className="input-field" placeholder="Search library..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                        </div>
                        <div className="category-tabs" style={{ padding: "0 12px" }}>
                            {categories.map(c => <button key={c.id} className={`category-tab ${activeCategory === c.id ? "active" : ""}`} onClick={() => setActiveCategory(c.id)}>{c.label}</button>)}
                        </div>
                        <div style={{ flex: 1, padding: "10px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", alignContent: "start" }}>
                            {filteredAssets.map(asset => (
                                <div key={asset.id} className="asset-card" onDoubleClick={() => setEditingAssetId(asset.id)}>
                                    <div className="asset-thumb">
                                        {asset.imageUrl ? <img src={asset.imageUrl} alt="" style={{ maxWidth: "80%", maxHeight: "80%" }} /> : <span>{asset.icon}</span>}
                                    </div>
                                    <div className="asset-name">{asset.name}</div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* AI Generation Sticky Footer */}
            {!selectedProp && !editingAssetId && (
                <div style={{ padding: "10px", borderTop: "1px solid var(--border-primary)" }}>
                    <button className="btn-generate" onClick={() => setShowGenerate(!showGenerate)}>✦ AI GENERATE 2D PROP</button>
                    {showGenerate && (
                        <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "6px" }}>
                            <input className="input-field" placeholder="Name" value={generateName} onChange={e => setGenerateName(e.target.value)} />
                            <textarea className="input-field" placeholder="Visual description..." value={generatePrompt} onChange={e => setGeneratePrompt(e.target.value)} style={{ minHeight: "60px" }} />
                            <button className="btn btn-primary" disabled={isGenerating} onClick={handleGenerate}>{isGenerating ? "Generating..." : "Generate"}</button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
