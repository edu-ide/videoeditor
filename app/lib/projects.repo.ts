// TypeORM implementation
import { AppDataSource } from "./data-source.js";
import { Project } from "./entities/Project.js";
import crypto from "crypto";

export type ProjectRecord = Project;

const getRepo = () => AppDataSource.getRepository(Project);

// Seed is no longer needed in the repo file as data persists in DB.
// You might want to run a seed script separately or check if empty.

export async function createProject(params: { userId: string; name: string; }): Promise<ProjectRecord> {
    const repo = getRepo();
    const project = repo.create({
        id: crypto.randomUUID(),
        user_id: params.userId,
        name: params.name,
        // created_at and updated_at are handled by @CreateDateColumn/@UpdateDateColumn
    });
    return await repo.save(project);
}

export async function listProjectsByUser(userId: string): Promise<ProjectRecord[]> {
    const repo = getRepo();
    return await repo.find({ where: { user_id: userId }, order: { created_at: "DESC" } });
}

export async function getProjectById(id: string): Promise<ProjectRecord | null> {
    const repo = getRepo();
    return await repo.findOne({ where: { id } });
}

export async function deleteProjectById(id: string, userId?: string): Promise<boolean> {
    const repo = getRepo();
    const result = await repo.delete(id);
    return (result.affected || 0) > 0;
}

export async function updateProject(id: string, updates: Partial<ProjectRecord>): Promise<ProjectRecord | null> {
    const repo = getRepo();
    await repo.update(id, updates);
    return await repo.findOne({ where: { id } });
}
