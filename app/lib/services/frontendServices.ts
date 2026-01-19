import * as Y from 'yjs';
import { io, Socket } from 'socket.io-client';
import { Awareness } from 'y-protocols/awareness';
import type { IYjsSyncClient } from './EffectContext.client.js';

export class YjsSyncClient implements IYjsSyncClient {
    public doc = new Y.Doc();
    public awareness = new Awareness(this.doc);
    private socket: Socket | null = null;

    private uint8ToBase64(uint8: Uint8Array): string {
        let binary = '';
        const len = uint8.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(uint8[i]);
        }
        return window.btoa(binary);
    }

    private base64ToUint8(base64: string): Uint8Array {
        const binaryString = window.atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    }

    private syncPromise: Promise<void> | null = null;
    private syncResolve: (() => void) | null = null;

    constructor() {
        this.syncPromise = new Promise((resolve) => {
            this.syncResolve = resolve;
        });
    }

    waitForSync(): Promise<void> {
        return this.syncPromise || Promise.resolve();
    }

    connect(projectId: string) {
        if (this.socket) return;
        // Connect to the current origin where the server is running
        this.socket = io(window.location.origin);

        this.socket.on('connect', () => {
            console.log('[YjsSyncClient] Connected to server');
            this.socket?.emit('yjs:join', { projectId });
        });

        this.socket.on('yjs:sync', ({ stateVector }) => {
            console.log('[YjsSyncClient] Received sync step 1 from server');
            const encodedSv = this.base64ToUint8(stateVector);
            // Compute the difference and send it back to server
            const update = Y.encodeStateAsUpdate(this.doc, encodedSv);
            this.socket?.emit('yjs:update', {
                docId: projectId,
                update: this.uint8ToBase64(update)
            });
            // Mark as synced
            this.syncResolve?.();
        });

        this.socket.on('yjs:update', ({ update }) => {
            const bin = this.base64ToUint8(update);
            Y.applyUpdate(this.doc, bin, 'remote');
        });

        this.socket.on('yjs:awareness', ({ update }) => {
            // applyAwarenessUpdate would go here
        });

        this.doc.on('update', (update, origin) => {
            if (origin !== 'remote' && this.socket) {
                const b64 = this.uint8ToBase64(update);
                this.socket.emit('yjs:update', { docId: projectId, update: b64 });
            }
        });
    }

    disconnect() {
        this.socket?.disconnect();
        this.socket = null;
        // Reset sync promise on disconnect
        this.syncPromise = new Promise((resolve) => {
            this.syncResolve = resolve;
        });
    }
}

// app/lib/services/McpClient.ts
import type { IMcpClient } from './EffectContext.client.js';

export class McpClient implements IMcpClient {
    async callTool(name: string, args: Record<string, any>): Promise<any> {
        console.log(`[McpClient] Calling tool ${name}`, args);
        // Future: implement SSE or fetch based tool calling
        return { success: true };
    }
}
