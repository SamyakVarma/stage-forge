// ============================================
// StageForge Scene Schema Types
// ============================================

/** A 3D position on the stage (meters from center) */
export interface Position3D {
    x: number; // left-right (stage-left negative, stage-right positive)
    y: number; // height above stage floor
    z: number; // upstage-downstage (upstage negative, downstage positive)
}

/** Rotation in degrees */
export interface Rotation3D {
    x: number;
    y: number;
    z: number;
}

/** Scale multiplier */
export interface Scale3D {
    x: number;
    y: number;
    z: number;
}

/** Keyframe for prop transformations */
export interface PropKeyframe {
    time: number; // seconds
    position?: Partial<Position3D>;
    rotation?: Partial<Rotation3D>;
    scale?: Partial<Scale3D>;
    lightColor?: string;
    lightPower?: number;
    lightAngle?: number;
    lightPenumbra?: number;
    intensity?: number; // for general props or screens
}

/** Asset types */
export type AssetType = "3d-model" | "2d-generated" | "2d-uploaded";

/** A prop/asset in the library */
export interface StageAsset {
    id: string;
    name: string;
    type: AssetType;
    category: string;

    // New folder-based structure
    assetFolder?: string;  // Path to public/assets/{assetId}/

    thumbnailUrl?: string; // URL or data URI for preview
    imageUrl?: string;     // Full-res image URL (usually under assetFolder)
    modelUrl?: string;     // GLB/GLTF URL (usually under assetFolder)

    icon?: string;         // Emoji fallback
    width?: number;        // meters
    height?: number;       // meters
    depth?: number;        // meters (for 3D)
    modularWidth?: number; // meters (for procedural repeating)
    isGenerated?: boolean; // was this AI-generated?
    generationPrompt?: string; // the prompt used to generate

    // Specific asset properties
    lightColor?: string;
    lightPower?: number;
    lightType?: "spotlight" | "diffuse" | "panel";
    lightAngle?: number; // conical spread in radians (0 to PI/2)
    lightPenumbra?: number; // 0 (hard) to 1 (soft)

    // Model alignment fixes (Asset-level)
    modelOffset?: { x: number; y: number; z: number };
    modelRotation?: { x: number; y: number; z: number };
}

/** A prop placement on stage — position + timing + keyframes */
export interface StageProp {
    id: string;           // unique prop instance ID (e.g. "prop-1")
    assetId: string;      // reference to StageAsset.id
    label: string;        // display label (e.g. "Center Mic Stand")

    // Default values (used if no keyframes or before/after)
    position: Position3D;
    rotation: Rotation3D;
    scale: Scale3D;

    // Instance-specific overrides
    lightColor?: string;
    lightPower?: number;
    lightAngle?: number;
    lightPenumbra?: number;

    // Resource overrides
    imageUrl?: string;    // Override asset image/video per prop
    width?: number;       // Override base asset width
    height?: number;     // Override base asset height

    enterTime: number;    // seconds from start when prop enters
    exitTime: number;     // seconds from start when prop exits (-1 = stays)
    layer: string;        // grouping: "props" | "lighting" | "screens" | "audio" | "structure" | "decor"
    visible: boolean;     // current visibility state

    keyframes?: PropKeyframe[];
}

/** The full scene state */
export interface SceneState {
    /** Unique project ID */
    id: string;

    /** Scene metadata */
    meta: {
        name: string;
        description: string;
        duration: number;     // total event duration in seconds
        stageWidth: number;   // meters
        stageDepth: number;   // meters
        stageHeight: number;  // meters (platform height)
        venueType: string;
        globalIllumination: number; // 0 to 1
    };

    /** All assets in the library */
    assets: StageAsset[];

    /** All placed props on stage */
    props: StageProp[];

    /** Current playback time in seconds */
    currentTime: number;

    /** UI State */
    selectedPropId?: string | null;
}

/** The JSON schema that Grok returns for scene generation */
export interface GrokSceneResponse {
    /** New assets that need to be generated (2D props via DALL-E) */
    newAssets: {
        tempId: string;       // temporary ID used in props array
        name: string;
        description: string;  // used as DALL-E prompt
        category: string;
        width: number;
        height: number;
    }[];

    /** Prop placements referencing asset IDs */
    props: {
        id: string;
        assetId: string;      // either existing asset ID or tempId from newAssets
        label: string;
        position: Position3D;
        rotation: Rotation3D;
        scale: Scale3D;
        enterTime: number;
        exitTime: number;
        layer: string;
        keyframes?: PropKeyframe[];
    }[];

    /** Updated scene metadata if applicable */
    meta?: {
        name?: string;
        description?: string;
        duration?: number;
    };
}

/** Chat message for AI Director */
export interface ChatMessage {
    id: string;
    role: "user" | "ai" | "system";
    content: string;
    timestamp: string;
    sceneUpdate?: GrokSceneResponse; // attached scene data if AI generated layout
    isLoading?: boolean;
}

/** Prop generation request */
export interface PropGenerationRequest {
    prompt: string;
    name: string;
    category: string;
}

/** Prop generation response */
export interface PropGenerationResponse {
    success: boolean;
    asset?: StageAsset;
    error?: string;
}
