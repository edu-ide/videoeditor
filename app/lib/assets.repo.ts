import { AppDataSource } from "./data-source.js";
import { Asset } from "./entities/Asset.js";
import crypto from "crypto";

const getRepo = () => AppDataSource.getRepository(Asset);

export async function insertAsset(data: {
  userId: string;
  projectId?: string | null;
  originalName: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  width?: number | null;
  height?: number | null;
  durationSeconds?: number | null;
}): Promise<Asset> {
  const repo = getRepo();
  const asset = repo.create({
    id: crypto.randomUUID(),
    user_id: data.userId,
    project_id: data.projectId || null,
    original_name: data.originalName,
    storage_key: data.storageKey,
    mime_type: data.mimeType,
    size_bytes: data.sizeBytes,
    width: data.width || null,
    height: data.height || null,
    duration_seconds: data.durationSeconds || null,
    // created_at handled by @CreateDateColumn
    deleted_at: null,
  });
  return await repo.save(asset);
}

export async function listAssetsByUser(userId: string, projectId: string | null): Promise<Asset[]> {
  const repo = getRepo();
  const where: any = { user_id: userId };
  if (projectId) where.project_id = projectId;

  // TypeORM soft delete handling (if @DeleteDateColumn is used, manually filtering deleted_at is not needed if we use softRemove, but here we check deleted_at manually or rely on typeorm features)
  // Actually @DeleteDateColumn automagically filters soft-deleted rows if using find(), unless withDeleted: true is passed.
  // However, let's keep it explicit if needed, but default behavior is fine.

  return await repo.find({ where, order: { created_at: "DESC" } });
}

export async function getAssetById(id: string): Promise<Asset | null> {
  const repo = getRepo();
  return await repo.findOne({ where: { id } });
}

export async function softDeleteAsset(id: string): Promise<void> {
  const repo = getRepo();
  await repo.softDelete(id);
}
