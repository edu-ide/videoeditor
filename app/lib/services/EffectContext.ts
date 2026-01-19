// app/lib/services/EffectContext.ts
import { Context } from 'effect';
import type { IYjsSyncService } from './YjsSyncService.js';
import type { IMcpServer } from './McpServer.js';

export const YjsSyncServiceTag = Context.GenericTag<IYjsSyncService>('YjsSyncService');
export const McpServerTag = Context.GenericTag<IMcpServer>('McpServer');
