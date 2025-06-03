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

    const isCaption = clip.type === 'caption'

    return (
        <div
            data-timeline-clip
            data-clip-id={clip.id}
            className={`absolute top-0 bottom-0 border rounded-md overflow-hidden ${
                isCaption 
                    ? 'bg-orange-100/50 border-orange-200' 
                    : 'bg-blue-100/50 border-blue-200'
            }`}
            style={{
                left,
                width,
            }}
        >
            <div className={`p-2 text-xs truncate ${
                isCaption ? 'text-orange-900' : 'text-blue-900'
            }`}>
                {clip.properties?.text || (isCaption ? 'Caption' : 'Text Clip')}
            </div>
        </div>
    )
} 