import { z } from "zod";
import {
  ProjectsResponseSchema,
  ProjectStateResponseSchema,
  CreateProjectBodySchema,
  PatchProjectBodySchema,
} from "~/schemas";
import type { MediaBinItem, TimelineState } from "~/components/timeline/types";
import { createProject, getProjectById, listProjectsByUser, deleteProjectById } from "~/lib/projects.repo";
import { listAssetsByUser, getAssetById, softDeleteAsset } from "~/lib/assets.repo";
import { loadProjectState, saveProjectState } from "~/lib/timeline.store";
import fs from "fs";
import path from "path";

// Mock requireUserId for login bypass
async function requireUserId(request: Request): Promise<string> {
  return "guest-user-id";
}

function generateId(): string {
  return `proj-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// Loader removed for SPA mode - API handled by Express server
// export async function loader({ request }: { request: Request }) {
//   ...
// }
const url = new URL(request.url);
const pathname = url.pathname;
const userId = await requireUserId(request);

// GET /api/projects -> list
if (pathname.endsWith("/api/projects") && request.method === "GET") {
  const rows = await listProjectsByUser(userId);
  const payload = ProjectsResponseSchema.parse({ projects: rows });
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

// GET /api/projects/:id -> get (owner only)
const m = pathname.match(/\/api\/projects\/([^/]+)$/);
if (m && request.method === "GET") {
  const id = m[1];
  const proj = await getProjectById(id);
  if (!proj || proj.user_id !== userId) return new Response("Not Found", { status: 404 });
  const state = await loadProjectState(id);
  const payload = ProjectStateResponseSchema.parse({
    project: proj,
    timeline: state.timeline,
    textBinItems: state.textBinItems,
  });
  return new Response(JSON.stringify(payload), { status: 200, headers: { "Content-Type": "application/json" } });
}

// DELETE /api/projects/:id -> delete project
if (m && request.method === "DELETE") {
  const id = m[1];
  const proj = await getProjectById(id);
  if (!proj || proj.user_id !== userId) return new Response("Not Found", { status: 404 });

  // Delete assets belonging to this project
  try {
    const assets = await listAssetsByUser(userId, id);
    for (const a of assets) {
      try {
        if (!a.storage_key) continue;
        const sanitizedKey = path.basename(a.storage_key);
        const filePath = path.resolve("out", sanitizedKey);
        if (filePath.startsWith(path.resolve("out")) && fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch {
        console.error("Failed to delete asset file");
      }
      await softDeleteAsset(a.id, userId);
    }
  } catch (e) {
    console.error("Failed to delete assets", e);
  }

  const ok = await deleteProjectById(id, userId);
  if (!ok) return new Response("Not Found", { status: 404 });

  // remove timeline file if exists
  try {
    // TIMELINE_DIR is used in timeline.store.ts, replicating logic here or using a method if available
    // timeline.store.ts doesn't export delete, so we do it manually or ignore for now
    const timelineDir = process.env.TIMELINE_DIR || "project_data";
    const p = path.resolve(timelineDir, `${id}.json`);
    if (fs.existsSync(p)) await fs.promises.unlink(p);
  } catch {
    // ignore
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

return new Response("Not Found", { status: 404 });
}

export async function action({ request }: { request: Request }) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const userId = await requireUserId(request);

  // POST /api/projects -> create
  if (pathname.endsWith("/api/projects") && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const parsed = CreateProjectBodySchema.safeParse(body);
    const name: string = parsed.success ? parsed.data.name : "Untitled Project";
    const proj = await createProject({ userId, name });
    return new Response(JSON.stringify({ project: proj }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  }

  // DELETE /api/projects/:id
  const delMatch = pathname.match(/\/api\/projects\/([^/]+)$/);
  if (delMatch && request.method === "DELETE") {
    const id = delMatch[1];
    const proj = await getProjectById(id);
    if (!proj || proj.user_id !== userId) return new Response("Not Found", { status: 404 });

    // cascade delete assets
    try {
      const assets = await listAssetsByUser(userId, id);
      for (const a of assets) {
        try {
          if (!a.storage_key) continue;
          const filePath = path.resolve("out", a.storage_key);
          if (filePath.startsWith(path.resolve("out")) && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch {
          console.error("Failed to delete asset");
        }
        await softDeleteAsset(a.id, userId);
      }
    } catch {
      console.error("Failed to delete assets");
    }

    const ok = await deleteProjectById(id, userId);
    if (!ok) return new Response("Not Found", { status: 404 });
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // PATCH /api/projects/:id -> rename or update timeline
  const patchMatch = pathname.match(/\/api\/projects\/([^/]+)$/);
  if (patchMatch && request.method === "PATCH") {
    const id = patchMatch[1];
    const proj = await getProjectById(id);
    if (!proj || proj.user_id !== userId) return new Response("Not Found", { status: 404 });
    const body = await request.json().catch(() => ({}));
    const parsed = PatchProjectBodySchema.safeParse(body);
    const name: string | undefined = parsed.success ? parsed.data.name : undefined;
    const timeline: TimelineState | undefined = (parsed.success ? parsed.data.timeline : undefined) as any;
    const textBinItems: MediaBinItem[] | undefined = (parsed.success ? parsed.data.textBinItems : undefined) as any;

    if (!name && !timeline && !textBinItems)
      return new Response(JSON.stringify({ error: "No changes" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });

    // Update name via repo (inline update removed, using direct repo calls if available, otherwise direct SQL via TypeORM)
    // projects.repo.ts doesn't have update function, we need to add it OR use DataSource directly here.
    // For cleaner code, let's assume we can add updateProject to repo, or just use DataSource here if needed.
    // But to keep it simple and consistent, let's implement update in repo. For now use direct access via DataSource since we switched to TypeORM.

    if (name) {
      // Ideally add updateProject to projects.repo.ts, but standard pattern:
      const { initializeDataSource } = await import("~/lib/data-source");
      const { Project } = await import("~/lib/entities/Project");
      const ds = await initializeDataSource();
      const repo = ds.getRepository(Project);
      await repo.update({ id, user_id: userId }, { name });
    }

    if (timeline || textBinItems) {
      const prev = await loadProjectState(id);
      await saveProjectState(id, {
        timeline: timeline ?? prev.timeline,
        textBinItems: textBinItems ?? prev.textBinItems,
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response("Not Found", { status: 404 });
}
