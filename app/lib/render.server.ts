import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import path from "path";
import fs from "fs";
import os from "os";
import { fileURLToPath } from "url";

// Helper for ESM __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function renderVideo(inputProps: any) {
    // 1. Bundle the Remotion project
    // Points to the file we just created
    const entryPoint = path.resolve(__dirname, "../../remotion/index.tsx");

    console.log("Creating bundle from:", entryPoint);

    const bundleLocation = await bundle({
        entryPoint,
        // If you need specific webpack config, you can add it here
        // For now, default should work for basic React/Tailwind
        onProgress: (progress) => console.log(`Bundle progress: ${progress}%`),
    });

    // 2. Select the composition (we named it "video")
    const composition = await selectComposition({
        serveUrl: bundleLocation,
        id: "video",
        inputProps,
    });

    // 3. Render the media
    const outputLocation = path.resolve(os.tmpdir(), `render-${Date.now()}.mp4`);
    console.log("Rendering to:", outputLocation);

    await renderMedia({
        composition,
        serveUrl: bundleLocation,
        codec: "h264",
        outputLocation,
        inputProps,
        onProgress: ({ progress }) => {
            console.log(`Rendering progress: ${Math.round(progress * 100)}%`);
        },
    });

    return outputLocation;
}
