import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60; // Set maximum execution time for the API route

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

const SYSTEM_PROMPT = `You are StageForge AI — a professional stage production director and layout designer.

Your job is to take a user's description of a stage event and generate a precise JSON layout of props, their positions, timing, and dynamic movements (keyframes).

## COORDINATE SYSTEM
- Stage is centered at (0, 0, 0). 
- X: Stage-Left (-) to Stage-Right (+). 
- Y: Height (0 = floor). 
- Z: Upstage/Back (-) to Downstage/Front (+).

## DYNAMIC MOVEMENTS (KEYFRAMES)
- Props can have an optional "keyframes" array for movements, rotations, or property changes.
- Each keyframe has a "time" (seconds).
- Example: A moving head light panning across the stage during a solo.

## OUTPUT FORMAT
Return ONLY valid JSON matching this schema:
{
  "newAssets": [
    { "tempId": "new-1", "name": "Asset Name", "description": "Visual desc", "category": "props|lighting|area", "width": 2, "height": 2 }
  ],
  "props": [
    {
      "id": "prop-1",
      "assetId": "asset-id",
      "label": "Label",
      "position": { "x": 0, "y": 0, "z": 0 },
      "rotation": { "x": 0, "y": 0, "z": 0 },
      "scale": { "x": 1, "y": 1, "z": 1 },
      "enterTime": 0,
      "exitTime": -1,
      "layer": "props",
      "keyframes": [
        { "time": 10, "position": { "x": 5 } },
        { "time": 20, "position": { "x": -5 } }
      ]
    }
  ],
  "meta": { "name": "Event", "description": "Desc", "duration": 180 }
}`;

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { prompt, availableAssets, stageWidth, stageDepth, currentScene } = body;

        if (!prompt) {
            return NextResponse.json(
                { success: false, error: "Missing prompt" },
                { status: 400 }
            );
        }

        if (!process.env.OPENROUTER_API_KEY) {
            return NextResponse.json(
                { success: false, error: "OpenRouter API key not configured. Add OPENROUTER_API_KEY to .env.local" },
                { status: 500 }
            );
        }

        // Build the user message with context
        const assetList = (availableAssets || [])
            .map((a: { id: string; name: string; type: string; category: string; width?: number; height?: number; depth?: number }) =>
                `- ID: "${a.id}" | Name: "${a.name}" | Type: ${a.type} | Category: ${a.category} | Size: ${a.width || "?"}m × ${a.height || "?"}m × ${a.depth || "?"}m`
            )
            .join("\n");

        const currentPropsInfo = currentScene?.props?.length
            ? `\n\nCurrent props already on stage:\n${currentScene.props
                .map((p: { id: string; assetId: string; label: string; position: { x: number; z: number }; enterTime: number }) =>
                    `- "${p.label}" (${p.assetId}) at position (${p.position.x}, ${p.position.z}), enters at ${p.enterTime}s`
                )
                .join("\n")}`
            : "";

        const userMessage = `Stage dimensions: ${stageWidth || 24}m wide × ${stageDepth || 16}m deep

Available assets in library:
${assetList || "(empty library)"}
${currentPropsInfo}

User's direction:
"${prompt}"

Generate the scene layout JSON. Remember: output ONLY the JSON, no other text.`;

        const response = await fetch(OPENROUTER_API_URL, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
                "Content-Type": "application/json",
                "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
                "X-Title": "StageForge",
            },
            body: JSON.stringify({
                model: "x-ai/grok-4.1-fast",
                messages: [
                    { role: "system", content: SYSTEM_PROMPT },
                    { role: "user", content: userMessage },
                ],
                temperature: 0.3, // lowered temperature for more reliable structural JSON
                max_tokens: 8192,
                response_format: { type: "json_object" }
            }),
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error("OpenRouter error:", response.status, errText);
            return NextResponse.json(
                { success: false, error: `OpenRouter API error: ${response.status}` },
                { status: 500 }
            );
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content) {
            return NextResponse.json(
                { success: false, error: "No response from Grok" },
                { status: 500 }
            );
        }

        // Parse the JSON response — handle potential markdown fences
        let sceneJson;
        try {
            // Strip markdown code fences if present
            let cleanContent = content.trim();
            if (cleanContent.startsWith("```")) {
                cleanContent = cleanContent.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
            }
            sceneJson = JSON.parse(cleanContent);
        } catch {
            console.error("Failed to parse Grok response:", content);
            return NextResponse.json(
                { success: false, error: "Failed to parse scene JSON from AI response", raw: content },
                { status: 500 }
            );
        }

        // Basic validation
        if (!sceneJson.props || !Array.isArray(sceneJson.props)) {
            return NextResponse.json(
                { success: false, error: "Invalid scene structure: missing props array" },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true, scene: sceneJson });
    } catch (error: unknown) {
        console.error("Scene parsing error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json(
            { success: false, error: `Failed to parse scene: ${message}` },
            { status: 500 }
        );
    }
}
