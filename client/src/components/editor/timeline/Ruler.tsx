import React from 'react'
import { useZoom } from '@/contexts/ZoomContext'
import { formatTimeMs } from '@/lib/utils'

// Configure your intervals here
// Each entry represents: [zoomLevel, intervalInMs]
const ZOOM_INTERVALS = [
    [3, 20],    // 20ms intervals when zoomed in 300%+
    [2, 50],    // 50ms intervals when zoomed in 200%+
    [1.5, 100], // 100ms intervals when zoomed in 150%+
    [1, 500],   // 500ms intervals at normal zoom
    [0.75, 1000], // 1s intervals when slightly zoomed out
    [0.5, 2000],  // 2s intervals when zoomed out
    [0.25, 5000], // 5s intervals when very zoomed out
    [0, 10000],   // 10s intervals when extremely zoomed out
] as const

interface RulerProps {
    /** total duration of the timeline in milliseconds */
    totalMs: number;
    /** pixels per millisecond */
    timeScale: number;
    /** optional height of the ruler bar */
    heightPx?: number;
}

export default function Ruler({
    totalMs,
    timeScale,
    heightPx = 24,
}: RulerProps) {
    const { zoomLevel } = useZoom()

    const getInterval = () => {
        for (const [zoomThreshold, interval] of ZOOM_INTERVALS) {
            if (zoomLevel >= zoomThreshold) {
                return interval
            }
        }
        return ZOOM_INTERVALS[ZOOM_INTERVALS.length - 1][1] // fallback to last interval
    }

    const intervalMs = getInterval()
    const ticks = []
    for (let ms = 0; ms <= totalMs; ms += intervalMs) {
        const x = ms * timeScale

        // Major tick every second
        const isMajorTick = ms % 1000 === 0

        // Only render major ticks
        if (isMajorTick) {
            ticks.push(
                <div key={ms} className="absolute" style={{ left: x }}>
                    {/* the vertical tick line */}
                    <div className="h-2 border-l border-gray-400" />
                    {/* the label */}
                    <div
                        className="absolute top-2 text-xs select-none text-gray-600 font-medium"
                        style={{ transform: 'translateX(-50%)' }}
                    >
                        {formatTimeMs(ms)}
                    </div>
                </div>
            )
        }
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