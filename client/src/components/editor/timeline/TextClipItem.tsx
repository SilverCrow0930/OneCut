import React from 'react'
import { Clip } from '@/types/editor'
import { getTimeScale } from '@/lib/constants'
import { useZoom } from '@/contexts/ZoomContext'

export default function TextClipItem({ clip }: { clip: Clip }) {
    const { zoomLevel } = useZoom()
    const timeScale = getTimeScale(zoomLevel)

    // convert ms → px
    const left = clip.timelineStartMs * timeScale
    const width = (clip.timelineEndMs - clip.timelineStartMs) * timeScale

    return (
        <div
            className="absolute top-0 bottom-0 bg-blue-100/50 border border-blue-200 rounded-md overflow-hidden"
            style={{
                left,
                width,
            }}
        >
            <div className="p-2 text-xs text-blue-900 truncate">
                {clip.properties?.text || 'Text Clip'}
            </div>
        </div>
    )
} 