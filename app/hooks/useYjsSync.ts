import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { YjsSyncClientTag, type IYjsSyncClient } from "../lib/services/EffectContext.client.js";
import { useEffectService } from "../lib/services/EffectReact.js";
import type { TimelineState } from "../components/timeline/types.js";

export const useYjsSync = (
    projectId: string | undefined,
    timeline: TimelineState,
    setTimelineFromServer: (newTimeline: TimelineState) => void
) => {
    const yjsClient = useEffectService(YjsSyncClientTag) as IYjsSyncClient;
    const isHandlingRemoteUpdate = useRef(false);

    useEffect(() => {
        if (!projectId) return;

        console.log(`[useYjsSync] Connecting to project: ${projectId}`);
        yjsClient.connect(projectId);

        const doc = yjsClient.doc;
        const timelineMap = doc.getMap("timeline");

        // 1. Handle remote updates from Yjs to local state
        const handleYjsUpdate = (event: Y.YEvent<any>[], transaction: Y.Transaction) => {
            if (transaction.origin === 'local-ui') return; // Ignore our own updates

            console.log("[useYjsSync] Remote update detected");
            const yTracks = timelineMap.get("tracks") as Y.Array<any>;
            if (yTracks) {
                isHandlingRemoteUpdate.current = true;
                try {
                    const newTimeline: TimelineState = {
                        tracks: yTracks.toJSON()
                    };
                    setTimelineFromServer(newTimeline);
                } finally {
                    isHandlingRemoteUpdate.current = false;
                }
            }
        };

        timelineMap.observeDeep(handleYjsUpdate);

        return () => {
            console.log(`[useYjsSync] Disconnecting from project: ${projectId}`);
            // Unobserve and disconnect if needed
            timelineMap.unobserveDeep(handleYjsUpdate);
            yjsClient.disconnect();
        };
    }, [projectId, yjsClient, setTimelineFromServer]);

    const [isSynced, setIsSynced] = useState(false);

    useEffect(() => {
        if (!projectId) {
            setIsSynced(false);
            return;
        }

        yjsClient.waitForSync().then(() => {
            console.log("[useYjsSync] Initial sync complete");
            setIsSynced(true);
        });
    }, [projectId, yjsClient]);

    // 2. Handle local updates from local state to Yjs
    useEffect(() => {
        if (!projectId || isHandlingRemoteUpdate.current || !isSynced) return;

        const doc = yjsClient.doc;
        const timelineMap = doc.getMap("timeline");

        doc.transact(() => {
            // Simple sync: overwrite the whole tracks array
            const yTracks = new Y.Array();
            yTracks.push(timeline.tracks);
            timelineMap.set("tracks", yTracks);
            timelineMap.set("updatedAt", Date.now());
        }, 'local-ui');

    }, [timeline, projectId, yjsClient, isSynced]);

    return yjsClient;
};
