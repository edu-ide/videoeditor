// app/lib/services/YjsSyncService.ts
/// <reference types="node" />
import * as Y from 'yjs';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import type { Server as IoServer } from 'socket.io';
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate } from 'y-protocols/awareness';

export interface IYjsSyncService {
    setIo(io: IoServer): void;
    getDoc(docId: string): Y.Doc;
    getAwareness(docId: string): Awareness;
    getReadyDoc(docId: string): Promise<Y.Doc>;
    applyRemoteUpdate(docId: string, updateB64: string): void;
    applyAwarenessUpdate(docId: string, updateB64: string): void;
    setTimelineState(docId: string, tracks: any[]): void;
    getTimelineState(docId: string): any;
    getStateVector(docId: string): Uint8Array;
    isTimelineEmpty(docId: string): boolean;
}

const Y_PERSIST_DIR = path.resolve(process.cwd(), 'data/yjs');

function yDocPath(docId: string) {
    return path.join(Y_PERSIST_DIR, `${docId}.bin`);
}

function uint8ToB64(arr: Uint8Array): string {
    return Buffer.from(arr).toString('base64');
}

function b64ToUint8(b64: string): Uint8Array {
    return new Uint8Array(Buffer.from(b64, 'base64'));
}

export class YjsSyncService implements IYjsSyncService {
    private docs = new Map<string, Y.Doc>();
    private loadingPromises = new Map<string, Promise<void>>();
    private saveTimers = new Map<string, NodeJS.Timeout>();
    private awareness = new Map<string, Awareness>();
    private io: IoServer | null = null;

    setIo(io: IoServer) {
        this.io = io;
    }

    private async ensurePersistDir() {
        try {
            await fs.mkdir(Y_PERSIST_DIR, { recursive: true });
        } catch (e: any) {
            // Ignore if exists
        }
    }

    private async loadFromDisk(docId: string, doc: Y.Doc) {
        try {
            await this.ensurePersistDir();
            const p = yDocPath(docId);
            const buf = await fs.readFile(p).catch(() => null);
            if (buf && buf.byteLength > 0) {
                Y.applyUpdate(doc, new Uint8Array(buf));
                console.log(`[YjsSyncService] Loaded ${buf.byteLength} bytes for project ${docId}`);
            }
        } catch (e) {
            console.warn(`[YjsSyncService] Failed to load doc ${docId}:`, (e as Error).message);
        }
    }

    private async persist(docId: string, doc: Y.Doc) {
        try {
            await this.ensurePersistDir();
            const update = Y.encodeStateAsUpdate(doc);
            await fs.writeFile(yDocPath(docId), Buffer.from(update));
            console.log(`[YjsSyncService] Persisted ${update.length} bytes for project ${docId} to disk`);

            // Also persist to DB (SQLite) to keep timeline column in sync
            const timelineState = this.getTimelineState(docId);
            if (timelineState.tracks && timelineState.tracks.length > 0) {
                const { updateProject } = await import('../projects.repo.js');
                await updateProject(docId, {
                    timeline: { tracks: timelineState.tracks }
                });
                console.log(`[YjsSyncService] Persisted timeline to DB for project ${docId}`);
            }
        } catch (e) {
            console.warn(`[YjsSyncService] Failed to persist doc ${docId}:`, (e as Error).message);
        }
    }

    private schedulePersist(docId: string, doc: Y.Doc, delayMs = 1000) {
        const prev = this.saveTimers.get(docId);
        if (prev) clearTimeout(prev);
        const t = setTimeout(() => {
            this.persist(docId, doc).catch(() => { });
        }, delayMs);
        this.saveTimers.set(docId, t);
    }

    getDoc(docId: string): Y.Doc {
        let doc = this.docs.get(docId);
        if (!doc) {
            doc = new Y.Doc({ gc: false });
            this.docs.set(docId, doc);

            doc.on('update', (update: Uint8Array, origin: any) => {
                if (this.io && origin !== 'remote') {
                    const b64 = uint8ToB64(update);
                    this.io.to(`yjs:${docId}`).emit('yjs:update', { docId, update: b64 });
                }
                this.schedulePersist(docId, doc!, 1000);
            });

            const promise = this.loadFromDisk(docId, doc).catch(e => {
                console.error(`[YjsSyncService] Error loading ${docId}:`, e);
            });
            this.loadingPromises.set(docId, promise);
        }
        return doc;
    }

    getAwareness(docId: string): Awareness {
        let awareness = this.awareness.get(docId);
        if (!awareness) {
            const doc = this.getDoc(docId);
            awareness = new Awareness(doc);
            this.awareness.set(docId, awareness);

            awareness.on('update', ({ added, updated, removed }: any, origin: any) => {
                if (origin === 'local' || origin === 'system') {
                    const update = encodeAwarenessUpdate(awareness!, added.concat(updated).concat(removed));
                    if (this.io) {
                        const b64 = uint8ToB64(update);
                        this.io.to(`yjs:${docId}`).emit('yjs:awareness', { docId, update: b64 });
                    }
                }
            });
        }
        return awareness;
    }

    async getReadyDoc(docId: string): Promise<Y.Doc> {
        const doc = this.getDoc(docId);
        const p = this.loadingPromises.get(docId);
        if (p) await p;
        return doc;
    }

    applyRemoteUpdate(docId: string, updateB64: string) {
        const doc = this.getDoc(docId);
        const bin = b64ToUint8(updateB64);
        Y.applyUpdate(doc, bin, 'remote');
    }

    applyAwarenessUpdate(docId: string, updateB64: string) {
        const awareness = this.getAwareness(docId);
        const update = b64ToUint8(updateB64);
        applyAwarenessUpdate(awareness, update, 'remote');
    }

    setTimelineState(docId: string, tracks: any[]) {
        const doc = this.getDoc(docId);
        doc.transact(() => {
            const timeline = doc.getMap('timeline');
            const yTracks = new Y.Array();
            yTracks.push(tracks);
            timeline.set('tracks', yTracks);
            timeline.set('updatedAt', Date.now());
        });
    }

    getTimelineState(docId: string): any {
        const doc = this.getDoc(docId);
        const timeline = doc.getMap('timeline');
        return {
            tracks: (timeline.get('tracks') as Y.Array<any>)?.toArray() || [],
            updatedAt: timeline.get('updatedAt') || 0
        };
    }

    getStateVector(docId: string): Uint8Array {
        const doc = this.getDoc(docId);
        return Y.encodeStateVector(doc);
    }

    isTimelineEmpty(docId: string): boolean {
        const doc = this.getDoc(docId);
        const timeline = doc.getMap('timeline');
        const tracks = timeline.get('tracks') as Y.Array<any>;
        return !tracks || tracks.length === 0;
    }
}
