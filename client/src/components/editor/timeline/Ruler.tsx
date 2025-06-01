import React from 'react'
import { useZoom } from '@/contexts/ZoomContext'
import { formatTimeMs } from '@/lib/utils'

interface RulerProps {
    /** total duration of the timeline in milliseconds */
    totalMs: number;
    /** pixels per millisecond */
    timeScale: number;
    /** optional height of the ruler bar */
    heightPx?: number;
}

// Helper: find a "nice" interval
function getNiceInterval(minMs: number) {
    const intervals = [
        1000, 2000, 5000, 10000, 15000, 30000, // seconds
        60000, 120000, 300000, 600000, 1800000, 3600000 // minutes/hours
    ];
    for (const interval of intervals) {
        if (interval >= minMs) return interval;
    }
    return intervals[intervals.length - 1];
}

export default function Ruler({
    totalMs,
    timeScale,
    heightPx = 24,
}: RulerProps) {
    const { zoomLevel } = useZoom()

    const minLabelSpacingPx = 80;
    const minIntervalMs = minLabelSpacingPx / timeScale;
    const intervalMs = getNiceInterval(minIntervalMs);
    let lastLabelX = -Infinity;
    const ticks = [];
    for (let ms = 0; ms <= totalMs; ms += intervalMs) {
        const x = ms * timeScale;
        const showLabel = x - lastLabelX >= minLabelSpacingPx;
        if (showLabel) lastLabelX = x;
        ticks.push(
            <div key={ms} className="absolute" style={{ left: x }}>
                <div className="h-2 border-l border-gray-400" />
                {showLabel && (
                    <div
                        className="absolute top-2 text-xs select-none text-gray-600 font-medium"
                        style={{ transform: 'translateX(-50%)' }}
                    >
                        {formatTimeMs(ms)}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div
            className="relative overflow-visible bg-white"
            style={{
                width: totalMs * timeScale,
                height: heightPx,
            }}
        >
            {ticks}
        </div>
    )
}