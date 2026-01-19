// app/lib/services/VideoEditorClientApp.ts
import { Layer, ManagedRuntime } from 'effect';
import { YjsSyncClientTag, McpClientTag } from './EffectContext.client';
import { YjsSyncClient, McpClient } from './frontendServices';

// Define Layers
export const YjsSyncClientLive = Layer.succeed(
    YjsSyncClientTag,
    new YjsSyncClient()
);

export const McpClientLive = Layer.succeed(
    McpClientTag,
    new McpClient()
);

// Compose Client App Layer
export const VideoEditorClientAppLayer = Layer.merge(
    YjsSyncClientLive,
    McpClientLive
);

// Create Client Runtime
export const clientRuntime = ManagedRuntime.make(VideoEditorClientAppLayer);
