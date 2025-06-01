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
            flex items-center gap-4
            px-4 py-3 rounded-xl
            text-black
            transition-all duration-300
            ${!hasTracks ? 'opacity-40' : ''}
        `}>
            <button
                onClick={
                    hasTracks ?
                        togglePlay :
                        undefined
                }
                className={`
                    p-2.5 rounded-xl
                    transition-all duration-300
                    ${hasTracks ? 
                        'hover:bg-green-50 hover:text-green-600 hover:shadow-md active:scale-95' : 
                        'cursor-not-allowed'
                    }
                `}
                disabled={!hasTracks}
            >
                {isPlaying ?
                    <Pause size={22} /> :
                    <Play size={22} />}
            </button>
            <span className="text-sm font-semibold tabular-nums whitespace-nowrap text-gray-700 bg-white/60 px-3 py-1.5 rounded-lg">
                {formatTimeMs(currentTime * 1000)} / {hasTracks ? formatTimeMs(duration) : '0:00'}
            </span>
        </div>
    )
} 