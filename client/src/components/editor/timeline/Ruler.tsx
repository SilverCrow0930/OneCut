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

// Helper: find a "nice" interval based on total duration
function getNiceInterval(minMs: number, totalDurationMs: number) {
    // Convert total duration to minutes for easier calculation
    const totalMinutes = totalDurationMs / 60000;
    
    // Define adaptive intervals based on total content duration
    let intervals: number[];
    
    if (totalMinutes <= 1) {
        // Very short content (≤1 min): Use second-based intervals
        intervals = [1000, 2000, 5000, 10000, 15000, 30000]; // 1s to 30s
    } else if (totalMinutes <= 10) {
        // Short content (1-10 min): Use smaller minute intervals
        intervals = [15000, 30000, 60000, 120000, 300000]; // 15s, 30s, 1min, 2min, 5min
    } else if (totalMinutes <= 60) {
        // Medium content (10-60 min): Use larger minute intervals
        intervals = [300000, 600000, 1200000, 1800000, 3600000]; // 5min, 10min, 20min, 30min, 1hr
    } else if (totalMinutes <= 360) {
        // Long content (1-6 hrs): Use hour-based intervals
        intervals = [600000, 1800000, 3600000, 7200000, 10800000]; // 10min, 30min, 1hr, 2hr, 3hr
    } else {
        // Very long content (>6 hrs): Use large hour intervals
        intervals = [3600000, 7200000, 10800000, 14400000, 21600000, 43200000]; // 1hr, 2hr, 3hr, 4hr, 6hr, 12hr
    }
    
    // Find the first interval that meets the minimum spacing requirement
    for (const interval of intervals) {
        if (interval >= minMs) return interval;
    }
    
    // If no interval is large enough, return the largest one
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
    const intervalMs = getNiceInterval(minIntervalMs, totalMs);
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