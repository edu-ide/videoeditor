// app/lib/services/McpServer.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    ListResourcesRequestSchema,
    ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { IYjsSyncService } from './YjsSyncService.js';

export interface IMcpServer {
    createSSETransport(res: any): SSEServerTransport;
    connect(transport: SSEServerTransport): Promise<void>;
}

/**
 * MCP Server for Try Kimu Video Editor
 */
export class McpServer implements IMcpServer {
    private server: Server;

    constructor(private yjs: IYjsSyncService) {
        this.server = new Server(
            {
                name: 'kimu-video-editor',
                version: '0.1.0',
            },
            {
                capabilities: {
                    tools: {},
                    resources: {},
                },
            }
        );

        this.setupHandlers();
    }

    private setupHandlers() {
        // List available tools
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            return {
                tools: [
                    {
                        name: 'get_project_timeline',
                        description: 'Get the current state of the video timeline (tracks and clips)',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                projectId: { type: 'string' },
                            },
                            required: ['projectId'],
                        },
                    },
                    {
                        name: 'add_clip',
                        description: 'Add a new clip (media or text) to the timeline',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                projectId: { type: 'string' },
                                trackId: { type: 'string' },
                                mediaId: { type: 'string' },
                                startAtInSeconds: { type: 'number' },
                                durationInSeconds: { type: 'number' },
                                mediaType: { enum: ['video', 'audio', 'image', 'text'] },
                                name: { type: 'string' },
                            },
                            required: ['projectId', 'trackId', 'mediaId', 'startAtInSeconds', 'durationInSeconds', 'mediaType'],
                        },
                    },
                    {
                        name: 'update_clip',
                        description: 'Update an existing clip in the timeline',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                projectId: { type: 'string' },
                                clipId: { type: 'string' },
                                startAtInSeconds: { type: 'number' },
                                durationInSeconds: { type: 'number' },
                                name: { type: 'string' },
                            },
                            required: ['projectId', 'clipId'],
                        },
                    },
                    {
                        name: 'delete_clip',
                        description: 'Delete a clip from the timeline',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                projectId: { type: 'string' },
                                clipId: { type: 'string' },
                            },
                            required: ['projectId', 'clipId'],
                        },
                    },
                ],
            };
        });

        // List available resources
        this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
            return {
                resources: [
                    {
                        uri: 'ui://widget/widget.html',
                        name: 'Kimu Video Editor Widget',
                        mimeType: 'text/html+skybridge',
                        description: 'A timeline visualization widget for Kimu Video Editor',
                    }
                ]
            };
        });

        // Read resource content
        this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
            const { uri } = request.params;
            if (uri === 'ui://widget/widget.html') {
                const __filename = fileURLToPath(import.meta.url);
                const __dirname = path.dirname(__filename);
                // Adjust path to assets/widget/widget.html relative to app/lib/services/McpServer.ts
                // app/lib/services/McpServer.ts -> ../../../assets/widget/widget.html
                const widgetPath = path.resolve(__dirname, '../../../assets/widget/widget.html');
                const content = fs.readFileSync(widgetPath, 'utf-8');
                return {
                    contents: [
                        {
                            uri,
                            mimeType: 'text/html+skybridge',
                            text: content,
                        }
                    ]
                };
            }
            throw new Error(`Resource not found: ${uri}`);
        });

        // Handle tool calls
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;

            try {
                switch (name) {
                    case 'get_project_timeline': {
                        const { projectId } = args as any;
                        const state = (await this.yjs.getTimelineState(projectId)) || { tracks: [] };
                        return {
                            content: [{ type: 'text', text: JSON.stringify(state, null, 2) }],
                            _meta: {
                                'openai/outputTemplate': 'ui://widget/widget.html'
                            }
                        };
                    }

                    case 'add_clip': {
                        const { projectId, trackId, mediaId, startAtInSeconds, durationInSeconds, mediaType, name: clipName } = args as any;
                        const doc = await this.yjs.getReadyDoc(projectId);

                        doc.transact(() => {
                            const timeline = doc.getMap('timeline');
                            let tracks = (timeline.get('tracks') as any)?.toArray() || [];

                            // Find or create track
                            let trackIndex = tracks.findIndex((t: any) => t.id === trackId);
                            if (trackIndex === -1) {
                                tracks.push({ id: trackId, name: `Track ${tracks.length + 1}`, scrubbers: [] });
                                trackIndex = tracks.length - 1;
                            }

                            const newClip = {
                                id: `clip-${Date.now()}`,
                                sourceMediaBinId: mediaId,
                                startAtInSeconds,
                                durationInSeconds,
                                mediaType,
                                name: clipName || `New ${mediaType}`,
                            };

                            tracks[trackIndex].scrubbers.push(newClip);

                            // Update Yjs
                            timeline.set('tracks', tracks);
                            timeline.set('updatedAt', Date.now());
                        });

                        return {
                            content: [{ type: 'text', text: `Successfully added ${mediaType} clip to track ${trackId}` }],
                            _meta: {
                                'openai/outputTemplate': 'ui://widget/widget.html'
                            }
                        };
                    }

                    default:
                        throw new Error(`Unknown tool: ${name}`);
                }
            } catch (error) {
                return {
                    isError: true,
                    content: [{ type: 'text', text: `Error: ${(error as Error).message}` }],
                };
            }
        });
    }

    createSSETransport(res: any) {
        return new SSEServerTransport('/api/mcp/message', res);
    }

    async connect(transport: SSEServerTransport) {
        await this.server.connect(transport);
    }
}
