// app/lib/services/VideoEditorApp.ts
import { Effect, Layer, ManagedRuntime } from 'effect';
import { YjsSyncServiceTag, McpServerTag } from './EffectContext.js';
import { YjsSyncService } from './YjsSyncService.js';
import { McpServer } from './McpServer.js';

// Define Layers
export const YjsSyncServiceLive = Layer.succeed(
    YjsSyncServiceTag,
    new YjsSyncService()
);

// McpServer depends on YjsSyncService
export const McpServerLive = Layer.effect(
    McpServerTag,
    Effect.map(YjsSyncServiceTag, (yjs) => new McpServer(yjs))
).pipe(Layer.provide(YjsSyncServiceLive));

// Compose App Layer - merge provides both services and has no requirements
export const VideoEditorAppLayer = Layer.merge(YjsSyncServiceLive, McpServerLive);

// Create a Managed Runtime to bridge Effect with regular Node.js code
export const appRuntime = ManagedRuntime.make(VideoEditorAppLayer);

/**
 * Helpers to run effects using the app runtime
 */
export const runPromise = appRuntime.runPromise;
export const runSync = appRuntime.runSync;
