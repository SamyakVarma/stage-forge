"use client";
import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import type { SceneState, StageAsset, StageProp, GrokSceneResponse, PropKeyframe } from "../types/scene";

// ============================================
// Default Scene State
// ============================================
const emojiToSvgUrl = (emoji: string) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text x="50" y="50" dominant-baseline="central" text-anchor="middle" font-size="90">${emoji}</text></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

const defaultAssets: StageAsset[] = [
    { id: "asset-mic-stand", name: "Mic Stand", type: "3d-model", category: "props", icon: "🎤", assetFolder: "/assets/asset-mic-stand", imageUrl: emojiToSvgUrl("🎤"), width: 0.3, height: 1.5, depth: 0.3 },
    { id: "asset-speaker-main", name: "Main Speaker", type: "3d-model", category: "audio", icon: "🔊", assetFolder: "/assets/asset-speaker-main", imageUrl: emojiToSvgUrl("🔊"), width: 0.8, height: 1.2, depth: 0.6 },
    { id: "asset-moving-head", name: "Moving Head", type: "3d-model", category: "lighting", icon: "💡", assetFolder: "/assets/asset-moving-head", imageUrl: emojiToSvgUrl("💡"), width: 0.4, height: 0.5, depth: 0.4, lightType: "spotlight", lightColor: "#ffffff", lightPower: 2, lightAngle: 0.4 },
    { id: "asset-panel-light", name: "Panel Light", type: "3d-model", category: "lighting", icon: "⬜", assetFolder: "/assets/asset-panel-light", imageUrl: emojiToSvgUrl("⬜"), width: 0.6, height: 0.4, depth: 0.1, lightType: "panel", lightColor: "#ffffff", lightPower: 3 },
    { id: "asset-drum-kit", name: "Drum Kit", type: "3d-model", category: "props", icon: "🥁", assetFolder: "/assets/asset-drum-kit", imageUrl: emojiToSvgUrl("🥁"), width: 1.5, height: 1.2, depth: 1.2 },
    { id: "asset-guitar-amp", name: "Guitar Amp", type: "3d-model", category: "props", icon: "🎸", assetFolder: "/assets/asset-guitar-amp", imageUrl: emojiToSvgUrl("🎸"), width: 0.6, height: 0.7, depth: 0.3 },
];

const defaultScene: SceneState = {
    meta: {
        name: "Untitled Event",
        description: "",
        duration: 240,
        stageWidth: 24,
        stageDepth: 16,
        stageHeight: 1.2,
        venueType: "outdoor",
    },
    assets: defaultAssets,
    props: [],
    currentTime: 0,
    selectedPropId: null,
};

// ============================================
// Context Type
// ============================================
interface SceneContextType {
    scene: SceneState;

    // Asset management
    addAsset: (asset: StageAsset) => void;
    updateAsset: (assetId: string, updates: Partial<StageAsset>) => void;
    removeAsset: (assetId: string) => void;

    // Prop management
    addProp: (prop: StageProp) => void;
    removeProp: (propId: string) => void;
    updateProp: (propId: string, updates: Partial<StageProp>) => void;
    setSelectedPropId: (id: string | null) => void;

    // Scene updates from Grok
    applySceneUpdate: (update: GrokSceneResponse, newAssetIdMap: Record<string, string>) => void;

    // Playback
    currentTime: number;
    setCurrentTime: (time: number) => void;
    isPlaying: boolean;
    setPlaying: (playing: boolean) => void;

    // Meta
    updateMeta: (updates: Partial<SceneState["meta"]>) => void;

    // Reset
    clearProps: () => void;
    resetScene: () => void;

    // Computed
    getVisibleProps: () => StageProp[];
    getInterpolatedProp: (propId: string) => StageProp | undefined;
    getAssetById: (id: string) => StageAsset | undefined;
}

// ============================================
// Context Provider
// ============================================
const SceneContext = createContext<SceneContextType | null>(null);

const SAVE_KEY = "stageforge_scene_v1";

export function SceneProvider({ children }: { children: ReactNode }) {
    const [scene, setScene] = useState<SceneState>(defaultScene);
    const [isLoaded, setIsLoaded] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);

    // Initial Load from LocalStorage
    useEffect(() => {
        const saved = localStorage.getItem(SAVE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                const mergedAssets = [...parsed.assets];
                defaultAssets.forEach(def => {
                    if (!mergedAssets.some(a => a.id === def.id)) {
                        mergedAssets.push(def);
                    }
                });
                setScene({ ...parsed, assets: mergedAssets, currentTime: 0, selectedPropId: null });
            } catch (e) {
                console.error("Failed to load saved scene", e);
            }
        }
        setIsLoaded(true);
    }, []);

    // Save to LocalStorage on change
    useEffect(() => {
        if (isLoaded) {
            localStorage.setItem(SAVE_KEY, JSON.stringify(scene));
        }
    }, [scene, isLoaded]);

    // Playback Loop
    useEffect(() => {
        if (!isPlaying) return;

        let lastTimestamp = performance.now();
        let frame: number;

        const tick = (now: number) => {
            const delta = (now - lastTimestamp) / 1000;
            lastTimestamp = now;

            setScene(prev => {
                const nextTime = prev.currentTime + delta;
                return {
                    ...prev,
                    currentTime: nextTime > prev.meta.duration ? 0 : nextTime
                };
            });
            frame = requestAnimationFrame(tick);
        };

        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [isPlaying]);

    const addAsset = useCallback((asset: StageAsset) => {

        setScene((prev) => ({
            ...prev,
            assets: [...prev.assets.filter((a) => a.id !== asset.id), asset],
        }));
    }, []);

    const updateAsset = useCallback((assetId: string, updates: Partial<StageAsset>) => {
        setScene((prev) => ({
            ...prev,
            assets: prev.assets.map((a) => (a.id === assetId ? { ...a, ...updates } : a)),
        }));
    }, []);

    const removeAsset = useCallback((assetId: string) => {
        setScene((prev) => ({
            ...prev,
            assets: prev.assets.filter((a) => a.id !== assetId),
        }));
    }, []);

    const addProp = useCallback((prop: StageProp) => {
        setScene((prev) => ({
            ...prev,
            props: [...prev.props.filter((p) => p.id !== prop.id), prop],
            selectedPropId: prop.id,
        }));
    }, []);

    const removeProp = useCallback((propId: string) => {
        setScene((prev) => ({
            ...prev,
            props: prev.props.filter((p) => p.id !== propId),
            selectedPropId: prev.selectedPropId === propId ? null : prev.selectedPropId,
        }));
    }, []);

    const updateProp = useCallback((propId: string, updates: Partial<StageProp>) => {
        setScene((prev) => ({
            ...prev,
            props: prev.props.map((p) => (p.id === propId ? { ...p, ...updates } : p)),
        }));
    }, []);

    const setSelectedPropId = useCallback((id: string | null) => {
        setScene((prev) => ({ ...prev, selectedPropId: id }));
    }, []);

    const applySceneUpdate = useCallback((update: GrokSceneResponse, newAssetIdMap: Record<string, string>) => {
        setScene((prev) => {
            const mappedProps: StageProp[] = update.props.map((p) => ({
                ...p,
                assetId: newAssetIdMap[p.assetId] || p.assetId,
                visible: true,
                keyframes: p.keyframes || []
            }));

            return {
                ...prev,
                props: [...prev.props, ...mappedProps],
                meta: {
                    ...prev.meta,
                    ...update.meta,
                },
            };
        });
    }, []);

    const setCurrentTime = useCallback((time: number) => {
        setScene((prev) => ({ ...prev, currentTime: time }));
    }, []);

    const updateMeta = useCallback((updates: Partial<SceneState["meta"]>) => {
        setScene((prev) => ({ ...prev, meta: { ...prev.meta, ...updates } }));
    }, []);

    const clearProps = useCallback(() => {
        setScene((prev) => ({ ...prev, props: [], selectedPropId: null }));
    }, []);

    const resetScene = useCallback(() => {
        setScene(defaultScene);
        localStorage.removeItem(SAVE_KEY);
    }, []);

    const getInterpolatedProp = useCallback((propId: string): StageProp | undefined => {
        const prop = scene.props.find(p => p.id === propId);
        if (!prop) return undefined;
        if (!prop.keyframes || prop.keyframes.length === 0) return prop;

        const time = scene.currentTime;
        const sortedKfs = [...prop.keyframes].sort((a, b) => a.time - b.time);

        let prevKf: PropKeyframe | null = null;
        let nextKf: PropKeyframe | null = null;

        for (const kf of sortedKfs) {
            if (kf.time <= time) prevKf = kf;
            else { nextKf = kf; break; }
        }

        if (!prevKf && !nextKf) return prop;
        if (!prevKf) return { ...prop, ...nextKf } as unknown as StageProp;
        if (!nextKf) return { ...prop, ...prevKf } as unknown as StageProp;

        const factor = (time - prevKf.time) / (nextKf.time - prevKf.time);
        const lerp = (v1: number, v2: number) => v1 + (v2 - v1) * factor;
        const lerpObj = (o1: any, o2: any) => {
            const result: any = { ...o1 };
            for (const key in o2) {
                if (typeof o1[key] === "number" && typeof o2[key] === "number") {
                    result[key] = lerp(o1[key], o2[key]);
                }
            }
            return result;
        };

        return {
            ...prop,
            position: prevKf.position && nextKf.position ? lerpObj(prevKf.position, nextKf.position) : (prevKf.position || prop.position),
            rotation: prevKf.rotation && nextKf.rotation ? lerpObj(prevKf.rotation, nextKf.rotation) : (prevKf.rotation || prop.rotation),
            scale: prevKf.scale && nextKf.scale ? lerpObj(prevKf.scale, nextKf.scale) : (prevKf.scale || prop.scale),
            lightPower: prevKf.lightPower !== undefined && nextKf.lightPower !== undefined ? lerp(prevKf.lightPower, nextKf.lightPower) : (prevKf.lightPower ?? prop.lightPower),
            lightAngle: prevKf.lightAngle !== undefined && nextKf.lightAngle !== undefined ? lerp(prevKf.lightAngle, nextKf.lightAngle) : (prevKf.lightAngle ?? prop.lightAngle),
            lightPenumbra: prevKf.lightPenumbra !== undefined && nextKf.lightPenumbra !== undefined ? lerp(prevKf.lightPenumbra, nextKf.lightPenumbra) : (prevKf.lightPenumbra ?? prop.lightPenumbra),
        } as unknown as StageProp;


    }, [scene.props, scene.currentTime]);

    const getVisibleProps = useCallback(() => {
        return scene.props.filter((p) => {
            if (!p.visible) return false;
            if (scene.currentTime < p.enterTime) return false;
            if (p.exitTime > 0 && scene.currentTime > p.exitTime) return false;
            return true;
        });
    }, [scene.props, scene.currentTime]);

    const getAssetById = useCallback(
        (id: string) => scene.assets.find((a) => a.id === id),
        [scene.assets]
    );

    return (
        <SceneContext.Provider
            value={{
                scene,
                addAsset,
                updateAsset,
                removeAsset,
                addProp,
                removeProp,
                updateProp,
                setSelectedPropId,
                applySceneUpdate,
                currentTime: scene.currentTime,
                setCurrentTime,
                isPlaying,
                setPlaying: setIsPlaying,
                updateMeta,
                clearProps,
                resetScene,
                getVisibleProps,
                getInterpolatedProp,
                getAssetById,
            }}
        >
            {children}
        </SceneContext.Provider>

    );
}

export function useScene() {
    const ctx = useContext(SceneContext);
    if (!ctx) throw new Error("useScene must be used within SceneProvider");
    return ctx;
}
