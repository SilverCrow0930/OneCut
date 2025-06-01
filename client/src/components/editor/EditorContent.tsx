import React from 'react'
import Player from './Player'
import PlaybackControls from './PlaybackControls'
import ClipTools from './ClipTools'
import ZoomSlider from './ZoomSlider'
import Timeline from './timeline/Timeline'

const EditorContent = () => {
    return (
        <div className="
            flex flex-col flex-1 overflow-hidden h-full 
            gap-0 p-2 rounded-lg
            focus:outline-none
        ">
            <div className="flex-1 pb-3 bg-gradient-to-b from-gray-50/50 to-transparent rounded-lg min-h-0">
                <Player />
            </div>
            <div className="
                flex w-full justify-between 
                bg-white/80 backdrop-blur-sm py-3 px-4 rounded-lg shadow-sm border border-gray-200/60
                mx-auto flex-shrink-0
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
            <div className="flex-1 pt-2 min-h-0 overflow-hidden">
                <Timeline />
            </div>
        </div>
    )
}

export default EditorContent 