import React from 'react'
import Menu from './Menu'
import { useAuth } from '@/contexts/AuthContext'
import { useEditor } from '@/contexts/EditorContext'
import ToolBar from './ToolBar'
import ToolPanel from './ToolPanel'
import Player from './Player'
import Assistant from './panels/Assistant'
import Timeline from './timeline/Timeline'
import PlaybackControls from './PlaybackControls'
import ClipTools from './ClipTools'
import ZoomSlider from './ZoomSlider'

const Editor = () => {
    const { session } = useAuth()
    const {
        project,
        loading,
        error,
        selectedTool,
        setSelectedTool
    } = useEditor()

    // Render states
    if (!session) {
        return (
            <div className="flex items-center justify-center w-screen h-screen">
                <p>Please sign in...</p>
            </div>
        )
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center w-screen h-screen">
                <p>Loading project...</p>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex items-center justify-center w-screen h-screen">
                <p className="text-red-500">Error: {error}</p>
            </div>
        )
    }

    if (!project) {
        return (
            <div className="flex items-center justify-center w-screen h-screen">
                <p>Project not found.</p>
            </div>
        )
    }

    return (
        <div className="
            flex flex-col items-center justify-center w-screen h-screen 
            p-2
        ">
            <Menu />
            <div className="
                flex flex-row items-center justify-center w-full h-full
            ">
                <div className="w-fit h-full">
                    <ToolBar
                        selectedTool={selectedTool}
                        onToolSelect={setSelectedTool}
                    />
                </div>
                <div className="w-80 h-full">
                    <ToolPanel />
                </div>
                <div className="
                    flex flex-col flex-1 overflow-hidden h-full 
                    bg-gray-200 gap-2 pt-2
                ">
                    <div className="h-full">
                        <Player />
                    </div>
                    <div className="flex w-full justify-between">
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
                <div className="w-80 h-full">
                    <Assistant />
                </div>
            </div>
        </div>
    )
}

export default Editor