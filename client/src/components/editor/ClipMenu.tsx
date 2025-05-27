import React from 'react'
import { SquareSplitHorizontal, Trash2, Crop, Move, RotateCw, Layers2 } from 'lucide-react'
import { useEditor } from '@/contexts/EditorContext'

const ClipMenu = ({ style }: { style?: React.CSSProperties }) => {
    const { selectedClipId, clips } = useEditor()

    // Find the selected clip
    const selectedClip = clips.find(clip => clip.id === selectedClipId)
    const hasSelectedClip = !!selectedClip

    if (!hasSelectedClip) return null

    return (
        <div
            className="flex items-center gap-2 bg-white/95 backdrop-blur-sm px-3 py-2 rounded-xl text-black shadow-lg"
            style={style}
        >
            <button
                className="p-1.5 rounded-lg hover:bg-gray-300 transition-colors"
                title="Crop"
            >
                <Crop size={16} />
            </button>
            <button
                className="p-1.5 rounded-lg hover:bg-gray-300 transition-colors"
                title="Rotate"
            >
                <RotateCw size={16} />
            </button>
            <div className="w-px h-4 bg-gray-600 mx-1" />
            <button
                className="p-1.5 rounded-lg hover:bg-gray-300 transition-colors text-red-500"
                title="Delete"
            >
                <Trash2 size={16} />
            </button>
        </div>
    )
}

export default ClipMenu 