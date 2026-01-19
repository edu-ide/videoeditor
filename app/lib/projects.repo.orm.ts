import { initializeDataSource } from "./data-source";
import { Project } from "./entities/Project";
import crypto from "crypto";

export type ProjectRecord = Project;

export async function createProject(params: {
    userId: string;
    name: string;
}): Promise<ProjectRecord> {
    const ds = await initializeDataSource();
    const repo = ds.getRepository(Project);

    const project = new Project();
    project.id = crypto.randomUUID();
    project.user_id = params.userId;
    project.name = params.name;

    return await repo.save(project);
}

export async function listProjectsByUser(
    userId: string
): Promise<ProjectRecord[]> {
    const ds = await initializeDataSource();
    const repo = ds.getRepository(Project);

    return await repo.find({
        where: { user_id: userId },
        order: { created_at: "DESC" }
    });
}

export async function getProjectById(
    id: string
): Promise<ProjectRecord | null> {
    const ds = await initializeDataSource();
    const repo = ds.getRepository(Project);

    return await repo.findOneBy({ id });
}

export async function deleteProjectById(
    id: string,
    userId: string
): Promise<boolean> {
    const ds = await initializeDataSource();
    const repo = ds.getRepository(Project);

    const result = await repo.delete({ id, user_id: userId });
    return (result.affected ?? 0) > 0;
}

export async function updateProject(
    id: string,
    updates: Partial<ProjectRecord>
): Promise<ProjectRecord | null> {
    const ds = await initializeDataSource();
    const repo = ds.getRepository(Project);

    const project = await repo.findOneBy({ id });
    if (!project) return null;

    Object.assign(project, updates);
    return await repo.save(project);
}

