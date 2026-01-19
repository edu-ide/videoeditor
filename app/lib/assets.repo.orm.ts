import { initializeDataSource } from "./data-source";
import { Asset } from "./entities/Asset";
import { IsNull } from "typeorm";
import crypto from "crypto";

export type AssetRecord = Asset;

export async function insertAsset(params: {
  userId: string;
  projectId?: string | null;
  originalName: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  width?: number | null;
  height?: number | null;
  durationSeconds?: number | null;
}): Promise<AssetRecord> {
  const ds = await initializeDataSource();
  const repo = ds.getRepository(Asset);

  const asset = new Asset();
  asset.id = crypto.randomUUID();
  asset.user_id = params.userId;
  asset.project_id = params.projectId || null as any; // TypeORM handles nulls, but TS might complain strictly
  asset.original_name = params.originalName;
  asset.storage_key = params.storageKey;
  asset.mime_type = params.mimeType;
  asset.size_bytes = params.sizeBytes;
  asset.width = params.width ?? 0;
  asset.height = params.height ?? 0;
  asset.duration_seconds = params.durationSeconds ?? 0;

  return await repo.save(asset);
}

export async function listAssetsByUser(
  userId: string,
  projectId: string | null
): Promise<AssetRecord[]> {
  const ds = await initializeDataSource();
  const repo = ds.getRepository(Asset);

  return await repo.find({
    where: {
      user_id: userId,
      project_id: projectId === null ? IsNull() : projectId,
      deleted_at: IsNull()
    },
    order: { created_at: "DESC" }
  });
}

export async function getAssetById(id: string): Promise<AssetRecord | null> {
  const ds = await initializeDataSource();
  const repo = ds.getRepository(Asset);

  return await repo.findOne({
    where: { id, deleted_at: IsNull() }
  });
}

export async function softDeleteAsset(
  id: string,
  userId: string
): Promise<void> {
  const ds = await initializeDataSource();
  const repo = ds.getRepository(Asset);

  await repo.softDelete({ id, user_id: userId });
}

