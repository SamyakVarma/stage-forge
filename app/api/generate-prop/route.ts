import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { prompt, name, category } = body;

        if (!prompt || !name) {
            return NextResponse.json(
                { success: false, error: "Missing prompt or name" },
                { status: 400 }
            );
        }

        const outputDir = path.join(process.cwd(), "public", "generated");
        const scriptPath = path.join(process.cwd(), "python", "prop_generator.py");

        const result = await new Promise<{ success: boolean; url?: string; error?: string }>((resolve) => {
            // we assume python is available in PATH
            const pythonProcess = spawn("python", [scriptPath, prompt, outputDir]);
            let stdoutData = "";
            let stderrData = "";

            pythonProcess.stdout.on("data", (data) => {
                stdoutData += data.toString();
            });

            pythonProcess.stderr.on("data", (data) => {
                stderrData += data.toString();
            });

            pythonProcess.on("close", (code) => {
                try {
                    // Output may contain download progress if model hasn't been downloaded before.
                    // Look for valid JSON at the end
                    const lines = stdoutData.trim().split('\n');
                    const lastLine = lines[lines.length - 1];
                    const response = JSON.parse(lastLine);

                    if (code === 0 && response.success) {
                        resolve({ success: true, url: response.url });
                    } else {
                        resolve({ success: false, error: response.error || stderrData || "Unknown error" });
                    }
                } catch (e) {
                    console.error("Failed to parse python output:", stdoutData);
                    resolve({ success: false, error: `Script execution failed (code: ${code}): ${stderrData || stdoutData}` });
                }
            });
        });

        if (!result.success || !result.url) {
            return NextResponse.json(
                { success: false, error: result.error || "No image url generated" },
                { status: 500 }
            );
        }

        const imageUrl = result.url;
        // Generate a unique asset ID
        const assetId = `asset-gen-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

        const asset = {
            id: assetId,
            name,
            type: "2d-generated" as const,
            category: category || "decor",
            imageUrl,
            thumbnailUrl: imageUrl,
            icon: "🎨",
            width: 2.0,  // default 2m
            height: 2.0,
            isGenerated: true,
            generationPrompt: prompt,
        };

        return NextResponse.json({ success: true, asset });
    } catch (error: unknown) {
        console.error("Prop generation error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json(
            { success: false, error: `Failed to generate prop: ${message}` },
            { status: 500 }
        );
    }
}
