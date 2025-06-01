import React from 'react'
import { useZoom } from '@/contexts/ZoomContext'
import { formatTimeMs } from '@/lib/utils'

interface RulerProps {
    /** total duration of the timeline in milliseconds */
    totalMs: number;
    /** pixels per millisecond */
    timeScale: number;
    /** actual content duration in milliseconds (without padding) */
    actualContentMs: number;
    /** optional height of the ruler bar */
    heightPx?: number;
}

// Helper: find a "nice" interval based on total content duration
function getNiceInterval(minMs: number, totalContentMs: number) {
    // Make interval adaptive based on total content duration
    let baseInterval: number;
    
    if (totalContentMs <= 5 * 60 * 1000) {
        // Content <= 5 minutes: use 30-second intervals
        baseInterval = 30000; // 30 seconds
    } else if (totalContentMs <= 30 * 60 * 1000) {
        // Content <= 30 minutes: use 1-minute intervals  
        baseInterval = 60000; // 1 minute
    } else if (totalContentMs <= 2 * 60 * 60 * 1000) {
        // Content <= 2 hours: use 10-minute intervals
        baseInterval = 600000; // 10 minutes
    } else if (totalContentMs <= 6 * 60 * 60 * 1000) {
        // Content <= 6 hours: use 30-minute intervals
        baseInterval = 1800000; // 30 minutes
    } else {
        // Content > 6 hours: use 1-hour intervals
        baseInterval = 3600000; // 1 hour
    }
    
    // Ensure the interval meets minimum spacing requirements
    const intervals = [
        1000, 2000, 5000, 10000, 15000, 30000, // seconds
        60000, 120000, 300000, 600000, 1800000, 3600000 // minutes/hours
    ];
    
    // Find the best interval that's >= both minMs and our adaptive baseInterval
    const targetInterval = Math.max(minMs, baseInterval);
    
    for (const interval of intervals) {
        if (interval >= targetInterval) return interval;
    }
    return intervals[intervals.length - 1];
}

export default function Ruler({
    totalMs,
    timeScale,
    actualContentMs,
    heightPx = 24,
}: RulerProps) {
    const { zoomLevel } = useZoom()

    const minLabelSpacingPx = 80;
    const minIntervalMs = minLabelSpacingPx / timeScale;
    const intervalMs = getNiceInterval(minIntervalMs, actualContentMs);
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