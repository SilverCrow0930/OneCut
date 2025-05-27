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
            gap-0 pt-2 border-l border-r border-gray-300
            focus:outline-none
        ">
            <div className="h-full pb-2">
                <Player />
            </div>
            <div className="
                flex w-full justify-between 
                bg-gray-200 py-1
            ">
                <div className="flex w-64 items-center px-2">
                    <ClipTools />
                </div>
                <div className="flex w-full items-center justify-center">
                    <PlaybackControls />
                </div>
                <div className="flex w-64 items-center justify-end px-2">
                    <ZoomSlider />
                </div>
            </div>
            <div className="h-full">
                <Timeline />
            </div>
        </div>
    )
}

export default EditorContent 