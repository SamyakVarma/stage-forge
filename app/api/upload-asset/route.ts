import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "node:fs/promises";
import path from "path";

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get("file") as File;
        const assetId = formData.get("assetId") as string;
        const type = formData.get("type") as "image" | "model";

        if (!file || !assetId || !type) {
            return NextResponse.json(
                { success: false, error: "Missing file, assetId, or type" },
                { status: 400 }
            );
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Sanitize filename
        const filename = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");

        // Ensure asset directory exists
        const assetDir = path.join(process.cwd(), "public", "assets", assetId);
        await mkdir(assetDir, { recursive: true });

        // Build file path
        const filePath = path.join(assetDir, filename);
        await writeFile(filePath, buffer);

        const publicUrl = `/assets/${assetId}/${filename}`;

        return NextResponse.json({
            success: true,
            url: publicUrl,
            filename: filename
        });
    } catch (error) {
        console.error("Upload error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to upload file" },
            { status: 500 }
        );
    }
}
