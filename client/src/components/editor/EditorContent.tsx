import React from 'react'
import { Player } from './Player'
import PlaybackControls from './PlaybackControls'
import ClipTools from './ClipTools'
import ZoomSlider from './ZoomSlider'
import Timeline from './timeline/Timeline'
import MarqueeSelection from './MarqueeSelection'
import { AspectRatioButton } from './AspectRatioButton'
import { useEditor } from '@/contexts/EditorContext'

const EditorContent = () => {
    const { tracks, clips } = useEditor()
    
    // Determine if timeline has content
    const hasContent = tracks.length > 0 && clips.length > 0
    
    return (
        <MarqueeSelection>
        <div className="flex flex-col h-full overflow-hidden gap-2 p-2 rounded-lg focus:outline-none">
            {/* Player area - flexible but prioritized */}
            <div className={`
                bg-gradient-to-b from-gray-50/50 to-transparent rounded-lg 
                overflow-hidden
                ${hasContent ? 'flex-[3]' : 'flex-[4]'}
                min-h-0
            `}>
                <Player />
            </div>
            
            {/* Controls bar - fixed height */}
            <div className="
                flex w-full justify-between 
                bg-white/80 backdrop-blur-sm py-1 px-4 rounded-lg shadow-sm border border-gray-200/60
                flex-shrink-0 z-10
            ">
                <div className="flex items-center gap-3 flex-shrink-0">
                    <ClipTools />
                </div>
                <div className="flex flex-1 items-center justify-center">
                    <PlaybackControls />
                </div>
                <div className="flex items-center justify-end gap-3 flex-shrink-0">
                    <ZoomSlider />
                    <AspectRatioButton />
                </div>
            </div>
            
            {/* Timeline area - adaptive height based on content */}
            <div className="
                overflow-hidden
                flex-shrink-0
                min-h-0
            ">
                <Timeline />
            </div>
        </div>
        </MarqueeSelection>
    )
}

export default EditorContent 