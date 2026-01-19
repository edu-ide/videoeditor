/// <reference types="node" />
import express from "express";
import { createServer as createViteServer } from "vite";
import * as http from "node:http";
import { Server as IoServer } from "socket.io";
import { appRuntime } from "./app/lib/services/VideoEditorApp.js";
import { YjsSyncServiceTag, McpServerTag } from "./app/lib/services/EffectContext.js";
import multer from "multer";
import * as path from "node:path";
import * as fs from "node:fs";
import { fileURLToPath } from "url";

// Polyfill __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const isProd = process.env.NODE_ENV === "production";

async function createServer() {
    const app = express();
    const httpServer = http.createServer(app);

    // --- Data Persistence Setup ---
    try {
        const { initializeDataSource } = await import("./app/lib/data-source.js");
        await initializeDataSource();
    } catch (e) {
        console.error("Failed to initialize database:", e);
        process.exit(1);
    }

    // --- DI Setup (Effect.ts) ---
    // In Effect 3.x, a Tag can be used directly as an Effect (but runSync needs an Effect)
    // We use appRuntime.runSync to resolve them
    const yjsService = appRuntime.runSync(YjsSyncServiceTag);
    const mcpServer = appRuntime.runSync(McpServerTag);

    const io = new IoServer(httpServer, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"],
        },
    });

    yjsService.setIo(io);

    // Middleware
    app.use(express.json());

    // --- Socket.IO Handlers ---
    io.on("connection", (socket) => {
        console.log(`[Socket.IO] Client connected: ${socket.id}`);

        socket.on("yjs:join", async ({ projectId }) => {
            socket.join(`yjs:${projectId}`);
            console.log(`[Socket.IO] Client ${socket.id} joined project ${projectId}`);

            // Hydrate Yjs doc from DB if empty (e.g. server restart)
            try {
                if (yjsService.isTimelineEmpty(projectId)) {
                    const { getProjectById } = await import("./app/lib/projects.repo.js");
                    const project = await getProjectById(projectId);
                    if (project && project.timeline) {
                        console.log(`[YjsSync] Hydrating empty Y-doc from DB for project ${projectId}`);
                        yjsService.setTimelineState(projectId, project.timeline.tracks || []);
                    }
                }
            } catch (e) {
                console.error("[YjsSync] Failed to hydrate from DB:", e);
            }

            // Send initial state vector for sync
            const sv = yjsService.getStateVector(projectId);
            socket.emit("yjs:sync", { docId: projectId, stateVector: Buffer.from(sv).toString("base64") });
        });

        socket.on("yjs:update", ({ docId, update }) => {
            yjsService.applyRemoteUpdate(docId, update);
        });

        socket.on("yjs:awareness", ({ docId, update }) => {
            yjsService.applyAwarenessUpdate(docId, update);
        });

        socket.on("disconnect", () => {
            console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
        });
    });

    // --- API Routes ---

    // Mock Auth Middleware
    const requireUser = (req: express.Request, res: express.Response, next: express.NextFunction) => {
        (req as any).user = { id: "guest-user-id" };
        next();
    };

    // MCP SSE Endpoints
    app.get("/api/mcp/sse", async (req, res) => {
        console.log("[MCP] New SSE connection");
        const transport = mcpServer.createSSETransport(res);
        await mcpServer.connect(transport);
    });

    app.post("/api/mcp/message", async (req, res) => {
        res.status(204).send();
    });

    // Projects API (Dynamic import to avoid potential circular/heavy loads)
    app.get("/api/projects", requireUser, async (req, res) => {
        try {
            const { listProjectsByUser } = await import("./app/lib/projects.repo.js");
            const userId = (req as any).user.id;
            const projects = await listProjectsByUser(userId);
            res.json({ projects });
        } catch (e) {
            res.status(500).json({ error: "Internal Server Error" });
        }
    });

    app.post("/api/projects", requireUser, async (req, res) => {
        try {
            const { createProject } = await import("./app/lib/projects.repo.js");
            const userId = (req as any).user.id;
            const { name } = req.body;
            if (!name) return res.status(400).json({ error: "Name is required" });

            const project = await createProject({ userId, name });
            res.status(201).json({ project });
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: "Internal Server Error" });
        }
    });

    app.get("/api/projects/:id", requireUser, async (req, res) => {
        try {
            const { getProjectById } = await import("./app/lib/projects.repo.js");
            const { id } = req.params;
            const project = await getProjectById(id as string);
            if (!project) return res.status(404).json({ error: "Project not found" });
            const timeline = project.timeline ?? null;
            const textBinItems = Array.isArray(project.textBinItems) ? project.textBinItems : [];
            res.json({ project, timeline, textBinItems });
        } catch (e) {
            res.status(500).json({ error: "Internal Server Error" });
        }
    });

    app.delete("/api/projects/:id", requireUser, async (req, res) => {
        try {
            const { deleteProjectById } = await import("./app/lib/projects.repo.js");
            const { id } = req.params;
            const userId = (req as any).user.id;
            await deleteProjectById(id as string, userId);
            res.json({ success: true });
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: "Internal Server Error" });
        }
    });

    app.patch("/api/projects/:id", requireUser, async (req, res) => {
        try {
            const { updateProject } = await import("./app/lib/projects.repo.js");
            const { id } = req.params;
            const { name, timeline, textBinItems } = req.body;
            const updates: any = {};
            if (name !== undefined) updates.name = name;
            if (timeline !== undefined) updates.timeline = timeline;
            if (textBinItems !== undefined) updates.textBinItems = textBinItems;

            const project = await updateProject(id as string, updates);
            if (!project) return res.status(404).json({ error: "Project not found" });
            res.json({ project });
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: "Internal Server Error" });
        }
    });

    // Assets API (Simplified)
    app.get("/api/assets", requireUser, async (req, res) => {
        try {
            const { listAssetsByUser } = await import("./app/lib/assets.repo.js");
            const userId = (req as any).user.id;
            const projectId = req.query.projectId as string | undefined;
            const assets = await listAssetsByUser(userId, projectId || null);

            // Map to the format expected by the frontend (AssetsResponseSchema)
            const mappedAssets = assets.map(a => ({
                id: a.id,
                name: a.original_name,
                mime_type: a.mime_type,
                size_bytes: a.size_bytes,
                width: a.width,
                height: a.height,
                duration_seconds: a.duration_seconds,
                durationInSeconds: a.duration_seconds, // duplicate for compatibility with schema
                created_at: a.created_at,
                mediaUrlRemote: a.storage_key,
            }));

            res.json({ assets: mappedAssets });
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: "Internal Server Error" });
        }
    });

    // --- File Upload Setup ---
    const UPLOADS_DIR = path.resolve(__dirname, "uploads");
    if (!fs.existsSync(UPLOADS_DIR)) {
        fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
    const upload = multer({
        storage: multer.diskStorage({
            destination: (req, file, cb) => cb(null, UPLOADS_DIR),
            filename: (req, file, cb) => {
                const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
                // Use extension only from originalname to avoid encoding issues on disk
                const ext = path.extname(file.originalname);
                cb(null, uniqueSuffix + ext);
            },
        }),
    });

    // Serve uploaded files statically
    app.use("/uploads", express.static(UPLOADS_DIR));

    // POST /api/assets - Upload file(s) (legacy)
    app.post("/api/assets", requireUser, upload.array("files"), async (req, res) => {
        try {
            const { insertAsset } = await import("./app/lib/assets.repo.js");
            const userId = (req as any).user.id;
            const projectId = (req.body?.projectId as string) || null;
            const files = req.files as Express.Multer.File[];

            if (!files || files.length === 0) {
                return res.status(400).json({ error: "No files uploaded" });
            }

            const assets = await Promise.all(
                files.map(async (file) => {
                    return await insertAsset({
                        userId,
                        projectId,
                        originalName: file.originalname,
                        storageKey: `/uploads/${file.filename}`,
                        mimeType: file.mimetype,
                        sizeBytes: file.size,
                    });
                })
            );

            res.status(201).json({ assets });
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: "Internal Server Error" });
        }
    });

    // POST /api/assets/upload - Upload single file (frontend uses this)
    app.post("/api/assets/upload", requireUser, upload.single("media"), async (req, res) => {
        try {
            const { insertAsset } = await import("./app/lib/assets.repo.js");
            const userId = (req as any).user.id;
            const file = req.file as Express.Multer.File;

            if (!file) {
                return res.status(400).json({ error: "No file uploaded" });
            }

            // Get metadata from headers (sent by frontend)
            // Type casting to handle Express headers issue
            const headers = req.headers as Record<string, string | string[] | undefined>;
            const width = parseInt(headers["x-media-width"] as string) || null;
            const height = parseInt(headers["x-media-height"] as string) || null;
            const durationSeconds = parseFloat(headers["x-media-duration"] as string) || null;
            const originalName = headers["x-original-name"]
                ? decodeURIComponent(headers["x-original-name"] as string)
                : file.originalname;
            const projectId = (headers["x-project-id"] as string) || null;

            const asset = await insertAsset({
                userId,
                projectId: projectId || null,
                originalName,
                storageKey: `/uploads/${file.filename}`,
                mimeType: file.mimetype,
                sizeBytes: file.size,
                width,
                height,
                durationSeconds,
            });

            // Return format expected by frontend
            res.status(201).json({
                success: true,
                asset: {
                    id: asset.id,
                    name: originalName,
                    mime_type: file.mimetype,
                    size_bytes: file.size,
                    width,
                    height,
                    duration_seconds: durationSeconds,
                    durationInSeconds: durationSeconds,
                    created_at: asset.created_at,
                    mediaUrlRemote: `/uploads/${file.filename}`,
                },
            });
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: "Internal Server Error" });
        }
    });

    app.get("/api/storage", requireUser, async (req, res) => {
        try {
            res.json({
                usedBytes: 0,
                limitBytes: 2 * 1024 * 1024 * 1024, // 2GB
            });
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: "Internal Server Error" });
        }
    });

    app.post("/api/render", async (req, res) => {
        console.log("Receive render request");
        try {
            const { renderVideo } = await import("./app/lib/render.server.js");
            const inputProps = req.body;

            // Validate essential props
            if (!inputProps.timelineData || !inputProps.durationInFrames) {
                return res.status(400).json({ error: "Missing timelineData or durationInFrames" });
            }

            console.log("Starting render job...");
            const outputLocation = await renderVideo(inputProps);

            console.log("Render complete. Sending file...");
            res.download(outputLocation, "rendered-video.mp4", (err) => {
                if (err) {
                    console.error("Error sending file:", err);
                    if (!res.headersSent) res.status(500).send("Error sending file");
                }
                // Cleanup temp file
                fs.unlink(outputLocation, (unlinkErr) => {
                    if (unlinkErr) console.error("Error deleting temp file:", unlinkErr);
                });
            });

        } catch (e) {
            console.error("Render failed:", e);
            res.status(500).json({
                error: e instanceof Error ? e.message : "Render failed"
            });
        }
    });

    // --- Vite ---

    if (!isProd) {
        // Create Vite server in middleware mode
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: "spa", // Disable SSR
        });
        // Use vite's connect instance as middleware
        app.use(vite.middlewares);

        // Fallback: Serve index.html for SPA (Dev Mode)
        app.get(/.*/, async (req, res, next) => {
            const url = req.originalUrl;
            if (url.startsWith("/api") || url.startsWith("/uploads")) return next();
            try {
                let template = fs.readFileSync(path.resolve(__dirname, "index.html"), "utf-8");
                template = await vite.transformIndexHtml(url, template);
                res.status(200).set({ "Content-Type": "text/html" }).send(template);
            } catch (e) {
                vite.ssrFixStacktrace(e as Error);
                next(e);
            }
        });
    } else {
        app.use(express.static(path.resolve(__dirname, "build/client")));
        app.get(/.*/, (req, res) => {
            res.sendFile(path.resolve(__dirname, "build/client/index.html"));
        });
    }

    httpServer.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}`);
    });
}

createServer();
