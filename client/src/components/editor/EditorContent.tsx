import React from 'react'
import Player from './Player'
import PlaybackControls from './PlaybackControls'
import ClipTools from './ClipTools'
import ZoomSlider from './ZoomSlider'
import Timeline from './timeline/Timeline'
import { useEditor } from '@/contexts/EditorContext'

const EditorContent = () => {
    const { tracks, clips } = useEditor()
    
    // Determine if timeline has content
    const hasContent = tracks.length > 0 && clips.length > 0
    
    return (
        <div className="
            flex flex-col h-full overflow-hidden 
            gap-2 p-2 rounded-lg
            focus:outline-none
        ">
            {/* Player area - dynamic height based on content */}
            <div className={`
                bg-gradient-to-b from-gray-50/50 to-transparent rounded-lg 
                flex-shrink-0 overflow-hidden
                ${hasContent ? 'h-[60vh]' : 'h-[70vh]'}
            `}>
                <Player />
            </div>
            
            {/* Controls bar - fixed height, no overlap */}
            <div className="
                flex w-full justify-between 
                bg-white/80 backdrop-blur-sm py-3 px-4 rounded-lg shadow-sm border border-gray-200/60
                flex-shrink-0 z-10
            ">
                <div className="flex w-64 items-center">
                    <ClipTools />
                </div>
                <div className="flex w-full items-center justify-center">
                    <PlaybackControls />
                </div>
                <div className="flex w-64 items-center justify-end">
                    <ZoomSlider />
                </div>
            </div>
            
            {/* Timeline area - takes remaining space with minimum height */}
            <div className="flex-1 overflow-hidden min-h-[250px]">
                <Timeline />
            </div>
        </div>
    )
}

export default EditorContent 