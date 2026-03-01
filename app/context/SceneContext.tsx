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
    { id: "asset-led-wall", name: "LED Wall Segment", type: "3d-model", category: "screens", icon: "🖥️", imageUrl: emojiToSvgUrl("🖥️"), width: 10, height: 6, depth: 0.2, lightType: "panel", lightColor: "#ffffff", lightPower: 1 },
    { id: "asset-truss", name: "Truss Structure", type: "3d-model", category: "structure", icon: "🏗️", imageUrl: emojiToSvgUrl("🏗️"), width: 2, height: 0.4, depth: 0.4, modularWidth: 2 },
];

const createDefaultScene = (name: string, width: number, depth: number): SceneState => {
    const id = Date.now().toString();
    const props: StageProp[] = [
        {
            id: `led-${id}`,
            assetId: "asset-led-wall",
            label: "Main LED Screen",
            position: { x: 0, y: 3, z: -depth / 2 },
            rotation: { x: 0, y: 0, z: 0 },
            scale: { x: width / 10, y: 1, z: 1 },
            enterTime: 0,
            exitTime: -1,
            layer: "screens",
            visible: true,
            lightPower: 1,
        },
        {
            id: `truss-front-${id}`,
            assetId: "asset-truss",
            label: "Front Lighting Rig",
            position: { x: 0, y: 8, z: depth / 2 - 2 },
            rotation: { x: 0, y: 0, z: 0 },
            scale: { x: width / 12, y: 1, z: 1 },
            enterTime: 0,
            exitTime: -1,
            layer: "structure",
            visible: true,
        },
        {
            id: `truss-back-${id}`,
            assetId: "asset-truss",
            label: "Back Lighting Rig",
            position: { x: 0, y: 8, z: -depth / 2 + 2 },
            rotation: { x: 0, y: 0, z: 0 },
            scale: { x: width / 12, y: 1, z: 1 },
            enterTime: 0,
            exitTime: -1,
            layer: "structure",
            visible: true,
        }
    ];

    return {
        id,
        meta: {
            name,
            description: "Initial Draft",
            duration: 300,
            stageWidth: width,
            stageDepth: depth,
            stageHeight: 1.2,
            venueType: "auditorium",
            globalIllumination: 0.2,
        },
        assets: defaultAssets,
        props,
        currentTime: 0,
        selectedPropId: null,
    };
};

// ============================================
// Context Type
// ============================================
interface SceneContextType {
    scene: SceneState | null;
    projects: SceneState[];
    assets: StageAsset[];

    // Project management
    createNewProject: (name: string, width: number, depth: number) => void;
    openProject: (id: string) => void;
    deleteProject: (id: string) => void;
    closeProject: () => void;

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

const SAVE_KEY = "stageforge_projects_v2";
const ASSETS_SAVE_KEY = "stageforge_assets_v2";

export function SceneProvider({ children }: { children: ReactNode }) {
    const [projects, setProjects] = useState<SceneState[]>([]);
    const [assets, setAssets] = useState<StageAsset[]>(defaultAssets);
    const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);

    const scene = projects.find(p => p.id === currentProjectId) || null;

    // Initial Load
    useEffect(() => {
        const savedProjects = localStorage.getItem(SAVE_KEY);
        if (savedProjects) {
            try {
                setProjects(JSON.parse(savedProjects));
            } catch (e) {
                console.error("Failed to load projects", e);
            }
        }

        const savedAssets = localStorage.getItem(ASSETS_SAVE_KEY);
        if (savedAssets) {
            try {
                setAssets(JSON.parse(savedAssets));
            } catch (e) {
                console.error("Failed to load assets", e);
            }
        }

        setIsLoaded(true);
    }, []);

    // Save on change
    useEffect(() => {
        if (isLoaded) {
            localStorage.setItem(SAVE_KEY, JSON.stringify(projects));
        }
    }, [projects, isLoaded]);

    useEffect(() => {
        if (isLoaded) {
            localStorage.setItem(ASSETS_SAVE_KEY, JSON.stringify(assets));
        }
    }, [assets, isLoaded]);

    const updateScene = useCallback((updater: (prev: SceneState) => SceneState) => {
        setProjects(prev => {
            if (!currentProjectId) return prev;
            return prev.map(p => p.id === currentProjectId ? updater(p) : p);
        });
    }, [currentProjectId]);

    const createNewProject = (name: string, width: number, depth: number) => {
        const newProj = createDefaultScene(name, width, depth);
        setProjects(prev => [...prev, newProj]);
        setCurrentProjectId(newProj.id);
    };

    const openProject = (id: string) => setCurrentProjectId(id);
    const closeProject = () => setCurrentProjectId(null);

    const deleteProject = (id: string) => {
        setProjects(prev => prev.filter(p => p.id !== id));
        if (currentProjectId === id) setCurrentProjectId(null);
    };

    // Playback Loop
    useEffect(() => {
        if (!isPlaying || !currentProjectId) return;
        let lastTimestamp = performance.now();
        let frame: number;
        const tick = (now: number) => {
            const delta = (now - lastTimestamp) / 1000;
            lastTimestamp = now;
            updateScene(prev => {
                const nextTime = prev.currentTime + delta;
                return { ...prev, currentTime: nextTime > prev.meta.duration ? 0 : nextTime };
            });
            frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [isPlaying, currentProjectId, updateScene]);

    const addAsset = useCallback((asset: StageAsset) => {
        setAssets(prev => [...prev.filter(a => a.id !== asset.id), asset]);
    }, []);

    const updateAsset = useCallback((assetId: string, updates: Partial<StageAsset>) => {
        setAssets(prev => prev.map(a => a.id === assetId ? { ...a, ...updates } : a));
    }, []);

    const removeAsset = useCallback((assetId: string) => {
        setAssets(prev => prev.filter(a => a.id !== assetId));
    }, []);

    const addProp = useCallback((prop: StageProp) => {
        updateScene(prev => ({
            ...prev,
            props: [...prev.props.filter(p => p.id !== prop.id), prop],
            selectedPropId: prop.id
        }));
    }, [updateScene]);

    const removeProp = useCallback((propId: string) => {
        updateScene(prev => ({
            ...prev,
            props: prev.props.filter(p => p.id !== propId),
            selectedPropId: prev.selectedPropId === propId ? null : prev.selectedPropId
        }));
    }, [updateScene]);

    const updateProp = useCallback((propId: string, updates: Partial<StageProp>) => {
        updateScene(prev => ({
            ...prev,
            props: prev.props.map(p => p.id === propId ? { ...p, ...updates } : p)
        }));
    }, [updateScene]);

    const setSelectedPropId = useCallback((id: string | null) => {
        updateScene(prev => ({ ...prev, selectedPropId: id }));
    }, [updateScene]);

    const applySceneUpdate = useCallback((update: GrokSceneResponse, newAssetIdMap: Record<string, string>) => {
        updateScene(prev => {
            const mappedProps: StageProp[] = update.props.map(p => ({
                ...p,
                assetId: newAssetIdMap[p.assetId] || p.assetId,
                visible: true,
                keyframes: p.keyframes || []
            }));
            return {
                ...prev,
                props: [...prev.props, ...mappedProps],
                meta: { ...prev.meta, ...update.meta }
            };
        });
    }, [updateScene]);

    const setCurrentTime = useCallback((time: number) => {
        updateScene(prev => ({ ...prev, currentTime: time }));
    }, [updateScene]);

    const updateMeta = useCallback((updates: Partial<SceneState["meta"]>) => {
        updateScene(prev => ({ ...prev, meta: { ...prev.meta, ...updates } }));
    }, [updateScene]);

    const clearProps = useCallback(() => {
        updateScene(prev => ({ ...prev, props: [], selectedPropId: null }));
    }, [updateScene]);

    const resetScene = useCallback(() => {
        if (currentProjectId) deleteProject(currentProjectId);
    }, [currentProjectId, deleteProject]);

    const getInterpolatedProp = useCallback((propId: string): StageProp | undefined => {
        if (!scene) return undefined;
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
        } as unknown as StageProp;
    }, [scene]);

    const getVisibleProps = useCallback(() => {
        if (!scene) return [];
        return scene.props.filter(p => {
            if (!p.visible || scene.currentTime < p.enterTime) return false;
            if (p.exitTime > 0 && scene.currentTime > p.exitTime) return false;
            return true;
        });
    }, [scene]);

    const getAssetById = useCallback((id: string) => assets.find(a => a.id === id), [assets]);

    return (
        <SceneContext.Provider value={{
            scene, projects, assets, createNewProject, openProject, deleteProject, closeProject,
            addAsset, updateAsset, removeAsset, addProp, removeProp, updateProp, setSelectedPropId,
            applySceneUpdate, currentTime: scene?.currentTime || 0, setCurrentTime, isPlaying, setPlaying: setIsPlaying,
            updateMeta, clearProps, resetScene, getVisibleProps, getInterpolatedProp, getAssetById
        }}>
            {children}
        </SceneContext.Provider>
    );
}

export function useScene() {
    const ctx = useContext(SceneContext);
    if (!ctx) throw new Error("useScene must be used within SceneProvider");
    return ctx;
}
