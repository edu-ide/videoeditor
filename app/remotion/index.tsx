import React from 'react';
import { Composition } from 'remotion';
import { TimelineComposition } from '../video-compositions/VideoPlayer.js';
import { TimelineDataItem, TimelineState, ScrubberState } from '../components/timeline/types.js';

// Define the input props structure
export type RenderProps = {
    timelineData: TimelineDataItem[];
    timeline: TimelineState;
    compositionWidth: number;
    compositionHeight: number;
    durationInFrames: number;
    getPixelsPerSecond: number;
};

// Wrapper ensuring all required props for TimelineComposition are present
const VideoComposition: React.FC<RenderProps> = ({
    timelineData,
    timeline,
    getPixelsPerSecond,
}) => {
    // Dummy handlers for rendering context (not used during render)
    const noop = () => { };
    const setNull = () => null;

    return (
        <TimelineComposition
            timelineData={timelineData}
            isRendering={true}
            selectedItem={null}
            setSelectedItem={setNull}
            timeline={timeline}
            handleUpdateScrubber={noop}
            getPixelsPerSecond={getPixelsPerSecond}
        />
    );
};

export const RemotionRoot: React.FC = () => {
    return (
        <>
            <Composition
                id="video"
                component={VideoComposition}
                durationInFrames={300} // Default, will be overridden by inputProps
                fps={30}
                width={1920} // Default
                height={1080} // Default
                defaultProps={{
                    timelineData: [],
                    timeline: { tracks: [] },
                    compositionWidth: 1920,
                    compositionHeight: 1080,
                    durationInFrames: 300,
                    getPixelsPerSecond: 100,
                } as RenderProps}
            />
        </>
    );
};
