import React from 'react'
import { Play, Pause } from 'lucide-react'
import { usePlayback } from '@/contexts/PlaybackContext'
import { useEditor } from '@/contexts/EditorContext'
import { formatTimeMs } from '@/lib/utils'

export default function PlaybackControls() {
    const { currentTime, duration, isPlaying, togglePlay } = usePlayback()
    const { tracks } = useEditor()
    const hasTracks = tracks.length > 0

    return (
        <div className={`
            flex items-center gap-3
            bg-gray-800/80 backdrop-blur-sm
            px-4 py-2.5 rounded-xl
            text-gray-100
            transition-all duration-200
            ${!hasTracks ? 'opacity-40' : 'hover:bg-gray-800'}
        `}>
            <button
                onClick={
                    hasTracks ?
                        togglePlay :
                        undefined
                }
                className={`
                    p-1 rounded-lg
                    transition-all duration-200
                    ${hasTracks ? 'hover:bg-gray-700' : 'cursor-not-allowed'}
                `}
                disabled={!hasTracks}
            >
                {isPlaying ?
                    <Pause size={18} /> :
                    <Play size={18} />}
            </button>
            <span className="text-sm font-medium tabular-nums whitespace-nowrap">
                {formatTimeMs(currentTime * 1000)} / {hasTracks ? formatTimeMs(duration) : '0:00'}
            </span>
        </div>
    )
} 