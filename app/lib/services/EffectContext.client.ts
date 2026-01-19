// app/lib/services/EffectContext.client.ts
import { Context } from 'effect';
import type * as Y from 'yjs';
import type { Awareness } from 'y-protocols/awareness';

export interface IYjsSyncClient {
    readonly doc: Y.Doc;
    readonly awareness: Awareness;
    connect(projectId: string): void;
    disconnect(): void;
    waitForSync(): Promise<void>;
}

export interface IMcpClient {
    callTool(name: string, args: Record<string, any>): Promise<any>;
}

export const YjsSyncClientTag = Context.GenericTag<IYjsSyncClient>('YjsSyncClient');
export const McpClientTag = Context.GenericTag<IMcpClient>('McpClient');
