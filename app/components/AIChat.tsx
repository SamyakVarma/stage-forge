"use client";
import { useState, useRef, useEffect } from "react";
import { useScene } from "../context/SceneContext";
import type { ChatMessage, GrokSceneResponse, StageAsset } from "../types/scene";

const initialMessages: ChatMessage[] = [
    {
        id: "m1",
        role: "ai",
        content:
            "Welcome to StageForge AI Director! 🎭\n\nDescribe your event and I'll generate a complete stage layout with props, positioning, and timing.\n\nExamples:\n• \"Set up a rock concert with drums center-stage, two guitar amps on each side, and a mic stand at the front\"\n• \"Create a corporate awards ceremony with a podium, two presentation screens, and spotlights\"\n• \"Design a DJ set with LED walls, turntable booth center, and speaker stacks\"",
        timestamp: "System",
    },
];

export default function AIChat() {
    const { scene, addAsset, applySceneUpdate } = useScene();
    const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
    const [input, setInput] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const addMessage = (msg: ChatMessage) => {
        setMessages((prev) => [...prev, msg]);
    };

    const handleSend = async () => {
        if (!input.trim() || isProcessing) return;

        const userPrompt = input.trim();
        setInput("");

        // Add user message
        addMessage({
            id: `m-${Date.now()}`,
            role: "user",
            content: userPrompt,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        });

        setIsProcessing(true);

        // Add "thinking" message
        const thinkingId = `thinking-${Date.now()}`;
        addMessage({
            id: thinkingId,
            role: "ai",
            content: "🧠 Analyzing your direction and generating scene layout...",
            timestamp: "",
            isLoading: true,
        });

        try {
            // Step 1: Call Grok to parse the scene
            const parseRes = await fetch("/api/parse-scene", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt: userPrompt,
                    availableAssets: scene.assets.map((a) => ({
                        id: a.id,
                        name: a.name,
                        type: a.type,
                        category: a.category,
                        width: a.width,
                        height: a.height,
                        depth: a.depth,
                    })),
                    stageWidth: scene.meta.stageWidth,
                    stageDepth: scene.meta.stageDepth,
                    currentScene: {
                        props: scene.props.map((p) => ({
                            id: p.id,
                            assetId: p.assetId,
                            label: p.label,
                            position: p.position,
                            enterTime: p.enterTime,
                        })),
                    },
                }),
            });

            const parseData = await parseRes.json();

            if (!parseData.success) {
                // Remove thinking message and show error
                setMessages((prev) => prev.filter((m) => m.id !== thinkingId));
                addMessage({
                    id: `err-${Date.now()}`,
                    role: "ai",
                    content: `❌ Failed to generate scene: ${parseData.error}\n\n${parseData.raw ? `Raw response:\n\`\`\`\n${parseData.raw.substring(0, 300)}\n\`\`\`` : ""}`,
                    timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                });
                setIsProcessing(false);
                return;
            }

            const sceneData: GrokSceneResponse = parseData.scene;

            // Step 2: Generate any new assets via DALL-E
            const newAssetIdMap: Record<string, string> = {};
            const newAssetsToGenerate = sceneData.newAssets || [];

            if (newAssetsToGenerate.length > 0) {
                // Update thinking message
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === thinkingId
                            ? { ...m, content: `🎨 Generating ${newAssetsToGenerate.length} new prop image(s) with Fluently-XL...` }
                            : m
                    )
                );

                for (const newAsset of newAssetsToGenerate) {
                    try {
                        const genRes = await fetch("/api/generate-prop", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                prompt: newAsset.description,
                                name: newAsset.name,
                                category: newAsset.category,
                            }),
                        });

                        const genData = await genRes.json();

                        if (genData.success && genData.asset) {
                            const asset: StageAsset = {
                                ...genData.asset,
                                width: newAsset.width,
                                height: newAsset.height,
                            };
                            addAsset(asset);
                            newAssetIdMap[newAsset.tempId] = asset.id;
                        } else {
                            // If generation fails, create a placeholder
                            const placeholderId = `asset-placeholder-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
                            addAsset({
                                id: placeholderId,
                                name: newAsset.name,
                                type: "2d-generated",
                                category: newAsset.category,
                                icon: "🎨",
                                width: newAsset.width,
                                height: newAsset.height,
                                isGenerated: true,
                                generationPrompt: newAsset.description,
                            });
                            newAssetIdMap[newAsset.tempId] = placeholderId;
                        }
                    } catch {
                        // Create placeholder on network error too
                        const placeholderId = `asset-placeholder-${Date.now()}`;
                        addAsset({
                            id: placeholderId,
                            name: newAsset.name,
                            type: "2d-generated",
                            category: newAsset.category,
                            icon: "🎨",
                            width: newAsset.width,
                            height: newAsset.height,
                            isGenerated: true,
                        });
                        newAssetIdMap[newAsset.tempId] = placeholderId;
                    }
                }
            }

            // Step 3: Apply the scene update
            applySceneUpdate(sceneData, newAssetIdMap);

            // Step 4: Replace thinking message with success
            const propCount = sceneData.props.length;
            const newAssetCount = newAssetsToGenerate.length;
            const sceneName = sceneData.meta?.name || "Scene";

            let summaryLines = [`✅ **${sceneName}** — Layout generated!`, ""];
            summaryLines.push(`📍 **${propCount} props** placed on stage`);
            if (newAssetCount > 0) {
                summaryLines.push(`🎨 **${newAssetCount} new props** generated via Fluently-XL`);
            }
            summaryLines.push("");
            summaryLines.push("**Props placed:**");
            sceneData.props.forEach((p, i) => {
                const enterLabel = p.enterTime === 0 ? "from start" : `at ${p.enterTime}s`;
                const exitLabel = p.exitTime <= 0 ? "stays" : `exits at ${p.exitTime}s`;
                summaryLines.push(
                    `  ${i + 1}. ${p.label} — pos (${p.position.x.toFixed(1)}, ${p.position.y.toFixed(1)}, ${p.position.z.toFixed(1)}) · ${enterLabel} · ${exitLabel}`
                );
            });
            summaryLines.push("");
            summaryLines.push("You can now see the layout in all viewports. Tell me if you'd like to adjust anything!");

            setMessages((prev) =>
                prev.map((m) =>
                    m.id === thinkingId
                        ? {
                            ...m,
                            content: summaryLines.join("\n"),
                            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                            isLoading: false,
                            sceneUpdate: sceneData,
                        }
                        : m
                )
            );
        } catch (error) {
            setMessages((prev) => prev.filter((m) => m.id !== thinkingId));
            addMessage({
                id: `err-${Date.now()}`,
                role: "ai",
                content: `❌ Error: ${error instanceof Error ? error.message : "Unknown error"}. Make sure your API keys are configured in .env.local`,
                timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="panel" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
            <div className="panel-header">
                <h3>
                    <span className="icon">🤖</span>
                    AI Director
                </h3>
                <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                    {isProcessing ? (
                        <>
                            <div style={{
                                width: "6px", height: "6px", borderRadius: "50%",
                                background: "var(--warning)",
                                animation: "pulse 1s ease-in-out infinite",
                            }} />
                            <span style={{ fontSize: "9px", color: "var(--warning)" }}>Processing</span>
                        </>
                    ) : (
                        <>
                            <div className="pulse-dot" />
                            <span style={{ fontSize: "9px", color: "var(--success)" }}>Ready</span>
                        </>
                    )}
                </div>
            </div>

            {/* Messages area */}
            <div style={{
                flex: 1,
                overflow: "auto",
                padding: "10px 12px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
            }}>
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: msg.role === "user" ? "flex-end" : "flex-start",
                        }}
                    >
                        <div className={`chat-message ${msg.role === "user" ? "user" : "ai"}`}>
                            {msg.isLoading ? (
                                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                    <span style={{ display: "flex", gap: "2px" }}>
                                        <span style={{ width: "4px", height: "4px", borderRadius: "50%", background: "var(--text-accent)", animation: "pulse 1s ease-in-out infinite", animationDelay: "0s" }} />
                                        <span style={{ width: "4px", height: "4px", borderRadius: "50%", background: "var(--text-accent)", animation: "pulse 1s ease-in-out infinite", animationDelay: "0.2s" }} />
                                        <span style={{ width: "4px", height: "4px", borderRadius: "50%", background: "var(--text-accent)", animation: "pulse 1s ease-in-out infinite", animationDelay: "0.4s" }} />
                                    </span>
                                    <span>{msg.content}</span>
                                </div>
                            ) : (
                                <div style={{ whiteSpace: "pre-wrap" }}>
                                    {msg.content.split(/(\*\*[^*]+\*\*)/).map((part, i) => {
                                        if (part.startsWith("**") && part.endsWith("**")) {
                                            return <strong key={i}>{part.slice(2, -2)}</strong>;
                                        }
                                        return <span key={i}>{part}</span>;
                                    })}
                                </div>
                            )}
                        </div>
                        {msg.timestamp && (
                            <span style={{ fontSize: "8px", color: "var(--text-muted)", marginTop: "2px", padding: "0 4px" }}>
                                {msg.timestamp}
                            </span>
                        )}
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Quick actions */}
            <div style={{
                padding: "6px 12px",
                display: "flex",
                gap: "4px",
                flexWrap: "wrap",
                borderTop: "1px solid var(--border-primary)",
            }}>
                {[
                    { label: "🎸 Rock Concert", prompt: "Set up a rock concert stage with drums center-back, two guitar amps on each side, a keyboard stage-left, bass amp stage-right, and a lead mic stand center-front. Add monitor wedges along the front edge." },
                    { label: "🎤 DJ Set", prompt: "Create a DJ booth center-stage with turntables, two large LED screens on each side, speaker stacks at the edges, and moving head lights on trusses." },
                    { label: "🏢 Corporate", prompt: "Set up a corporate keynote stage with a centered podium, two presentation screens flanking the stage, subtle uplighting, and a speaker lectern." },
                    { label: "🎭 Theater", prompt: "Arrange a theater stage with a grand piano stage-right, a sofa center, two chairs, a small table with a lamp, and a bookshelf backdrop." },
                ].map((action, i) => (
                    <button
                        key={i}
                        className="btn btn-secondary"
                        style={{ fontSize: "9px", padding: "3px 7px" }}
                        onClick={() => setInput(action.prompt)}
                        disabled={isProcessing}
                    >
                        {action.label}
                    </button>
                ))}
            </div>

            {/* Input area */}
            <div style={{
                padding: "10px 12px",
                borderTop: "1px solid var(--border-primary)",
                display: "flex",
                gap: "6px",
                alignItems: "flex-end",
                flexShrink: 0,
            }}>
                <textarea
                    className="input-field"
                    placeholder={isProcessing ? "Processing scene..." : "Describe your stage setup, event, or adjustments..."}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isProcessing}
                    style={{
                        flex: 1,
                        minHeight: "36px",
                        maxHeight: "100px",
                        resize: "none",
                        fontFamily: "var(--font-sans)",
                        opacity: isProcessing ? 0.6 : 1,
                    }}
                />
                <button
                    className="btn btn-primary"
                    onClick={handleSend}
                    disabled={!input.trim() || isProcessing}
                    style={{
                        padding: "8px 12px",
                        opacity: input.trim() && !isProcessing ? 1 : 0.5,
                        cursor: input.trim() && !isProcessing ? "pointer" : "default",
                        flexShrink: 0,
                    }}
                >
                    {isProcessing ? "⏳" : "↑"}
                </button>
            </div>
        </div>
    );
}
