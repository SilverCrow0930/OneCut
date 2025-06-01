import React, { useState, useEffect } from 'react'
import Menu from './Menu'
import { useAuth } from '@/contexts/AuthContext'
import { useEditor } from '@/contexts/EditorContext'
import ToolBar from './ToolBar'
import ToolPanel from './ToolPanel'
import Assistant from './panels/Assistant'
import ResizeHandle from './ResizeHandle'
import EditorContent from './EditorContent'

const LoadingSpinner = () => (
    <div className="relative w-5 h-5">
        <div className="absolute inset-0 border-2 border-gray-200 rounded-full" />
        <div className="absolute inset-0 border-2 border-blue-400 rounded-full animate-[spin_0.8s_linear_infinite] border-t-transparent" />
    </div>
)

const StateMessage = ({ children, icon }: { children: React.ReactNode, icon?: React.ReactNode }) => (
    <div className="flex items-center gap-3 text-gray-600 bg-gray-50 px-6 py-4 rounded-xl shadow-sm">
        {icon}
        <span className="font-medium">{children}</span>
    </div>
)

const Editor = () => {
    const { session } = useAuth()
    const {
        project,
        loading,
        error,
        selectedTool,
        setSelectedTool,
        setSelectedClipId
    } = useEditor()

    const [assistantWidth, setAssistantWidth] = useState(384)

    const handleAssistantResize = (deltaX: number) => {
        setAssistantWidth(prev => Math.max(200, Math.min(800, prev - deltaX)))
    }

    // Deselect clip on global click (outside any clip)
    useEffect(() => {
        const handleGlobalClick = (e: MouseEvent) => {
            // Only deselect if the click is not inside a clip (ClipLayer uses data-clip-layer)
            // or inside the text tool panel
            let el = e.target as HTMLElement | null
            while (el) {
                if (el.hasAttribute && (
                    el.hasAttribute('data-clip-layer') ||
                    el.closest('[data-text-tool-panel]')
                )) return
                el = el.parentElement
            }
            setSelectedClipId(null)
        }
        document.addEventListener('click', handleGlobalClick)
        return () => {
            document.removeEventListener('click', handleGlobalClick)
        }
    }, [setSelectedClipId])

    // Render states
    if (!session) {
        return (
            <div className="flex items-center justify-center w-screen h-screen bg-gradient-to-br from-gray-50 to-gray-100">
                <StateMessage icon={<LoadingSpinner />}>
                    Signing in...
                </StateMessage>
            </div>
        )
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center w-screen h-screen bg-gradient-to-br from-gray-50 to-gray-100">
                <StateMessage icon={<LoadingSpinner />}>
                    Loading project...
                </StateMessage>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex items-center justify-center w-screen h-screen bg-gradient-to-br from-gray-50 to-gray-100">
                <StateMessage icon={<LoadingSpinner />}>
                    <span className="text-red-500">Error:</span> {error}
                </StateMessage>
            </div>
        )
    }

    if (!project) {
        return (
            <div className="flex items-center justify-center w-screen h-screen bg-gradient-to-br from-gray-50 to-gray-100">
                <StateMessage>
                    Project not found
                </StateMessage>
            </div>
        )
    }

    return (
        <div className="
            flex flex-col w-screen h-screen overflow-hidden
            bg-gradient-to-br from-slate-50 to-gray-100
        ">
            <Menu />
            <div className="
                flex flex-row flex-1 min-h-0 gap-1 p-1
            ">
                <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-sm border border-gray-200/60">
                    <ToolBar
                        selectedTool={selectedTool}
                        onToolSelect={setSelectedTool}
                    />
                </div>
                <div className="w-80 bg-white/80 backdrop-blur-sm rounded-lg shadow-sm border border-gray-200/60">
                    <ToolPanel />
                </div>
                <div className="flex-1 bg-white/60 backdrop-blur-sm rounded-lg shadow-sm border border-gray-200/60">
                    <EditorContent />
                </div>
                <div className="relative bg-white/80 backdrop-blur-sm rounded-lg shadow-sm border border-gray-200/60" style={{ width: assistantWidth }}>
                    <ResizeHandle
                        className="absolute -left-2 z-10"
                        onResize={handleAssistantResize}
                    />
                    <Assistant />
                </div>
            </div>
        </div>
    )
}

export default Editor