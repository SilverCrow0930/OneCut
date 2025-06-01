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
            <div className="h-full pb-3 bg-gradient-to-b from-gray-50/50 to-transparent rounded-lg">
                <Player />
            </div>
            
            {/* Enhanced Control Panel */}
            <div className="
                flex w-full justify-between items-center
                bg-gradient-to-r from-white/95 to-gray-50/95 backdrop-blur-lg 
                py-4 px-6 mx-2 my-2 rounded-2xl 
                shadow-lg border border-gray-200/50
                transition-all duration-300 hover:shadow-xl
            ">
                <div className="flex items-center">
                    <div className="bg-white/80 backdrop-blur-sm rounded-xl p-1 shadow-sm border border-gray-200/60">
                        <ClipTools />
                    </div>
                </div>
                
                <div className="flex items-center">
                    <div className="bg-white/80 backdrop-blur-sm rounded-xl p-1 shadow-sm border border-gray-200/60">
                        <PlaybackControls />
                    </div>
                </div>
                
                <div className="flex items-center">
                    <div className="bg-white/80 backdrop-blur-sm rounded-xl p-1 shadow-sm border border-gray-200/60">
                        <ZoomSlider />
                    </div>
                </div>
            </div>
            
            <div className="h-full pt-2">
                <Timeline />
            </div>
        </div>
    )
}

export default EditorContent 