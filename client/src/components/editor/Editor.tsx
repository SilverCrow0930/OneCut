import React, { useState, useEffect } from 'react'
import Menu from './Menu'
import { useAuth } from '@/contexts/AuthContext'
import { useEditor } from '@/contexts/EditorContext'

import ToolBar from './ToolBar'
import ToolPanel from './ToolPanel'
import Assistant from './panels/Assistant'
import ResizeHandle from './ResizeHandle'
import EditorContent from './EditorContent'
import { useParams } from 'next/navigation'

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
        setSelectedClipId,
        selectedClipId,
        executeCommand,
        clips,
        tracks,
        selectedClipIds,
        setSelectedClipIds,
        undo,
        redo,
        canUndo,
        canRedo
    } = useEditor()
    const params = useParams()
    const [assistantWidth, setAssistantWidth] = useState(480)

    // Load assistant width from localStorage on mount
    useEffect(() => {
        const savedWidth = localStorage.getItem('lemona-assistant-width')
        if (savedWidth) {
            const width = parseInt(savedWidth, 10)
            if (width >= 200 && width <= 800) {
                setAssistantWidth(width)
            }
        }
    }, [])

    const handleAssistantResize = (deltaX: number) => {
        const newWidth = Math.max(200, Math.min(800, assistantWidth - deltaX))
        setAssistantWidth(newWidth)
        // Save to localStorage
        localStorage.setItem('lemona-assistant-width', newWidth.toString())
    }

    // Handle tool selection with toggle functionality
    const handleToolSelect = (tool: string) => {
        if (selectedTool === tool) {
            // If the same tool is clicked, close the tool panel
            setSelectedTool(null)
        } else {
            // Otherwise, select the new tool
            setSelectedTool(tool)
        }
    }

    // Function to delete multiple selected clips (same logic as in ClipTools.tsx)
    const handleDeleteMultipleSelectedClips = () => {
        const selectedClips = clips.filter(clip => selectedClipIds.includes(clip.id))
        if (selectedClips.length === 0) return

        const commands: any[] = []
        const tracksToCheck = new Set<string>()
        
        // Collect tracks that might become empty
        selectedClips.forEach(clip => {
            tracksToCheck.add(clip.trackId)
            commands.push({
                type: 'REMOVE_CLIP',
                payload: { clip }
            })
        })
        
        // Check which tracks become empty and remove them
        tracksToCheck.forEach(trackId => {
            const track = tracks.find(t => t.id === trackId)
            if (!track) return
            
            const remainingClipsInTrack = clips.filter(c => 
                c.trackId === trackId && !selectedClipIds.includes(c.id)
            )
            
            if (remainingClipsInTrack.length === 0) {
                commands.push({
                    type: 'REMOVE_TRACK',
                    payload: { track, affectedClips: [] }
                })
            }
        })
        
        // Reindex remaining tracks
        const remainingTracks = tracks.filter(t => !Array.from(tracksToCheck).some(trackId => {
            const track = tracks.find(tr => tr.id === trackId)
            if (!track) return false
            const remainingClipsInTrack = clips.filter(c => 
                c.trackId === trackId && !selectedClipIds.includes(c.id)
            )
            return remainingClipsInTrack.length === 0
        }))
        
        const reindexedTracks = remainingTracks.map((t, index) => ({ ...t, index }))
        reindexedTracks.forEach(track => {
            const originalTrack = tracks.find(t => t.id === track.id)
            if (originalTrack && originalTrack.index !== track.index) {
                commands.push({
                    type: 'UPDATE_TRACK',
                    payload: { before: originalTrack, after: track }
                })
            }
        })
        
        executeCommand({
            type: 'BATCH',
            payload: { commands }
        })

        // Clear selection after deletion
        setSelectedClipIds([])
        setSelectedClipId(null)
    }

    // Function to delete selected clip (same logic as in ClipTools.tsx)
    const handleDeleteSelectedClip = () => {
        const selectedClip = clips.find(clip => clip.id === selectedClipId)
        if (!selectedClip) return

        // Find the track
        const track = tracks.find(t => t.id === selectedClip.trackId)
        if (!track) return

        // Check if the track becomes empty after removing this clip
        const remainingClipsInTrack = clips.filter(c => c.trackId === selectedClip.trackId && c.id !== selectedClip.id)

        if (remainingClipsInTrack.length === 0) {
            // Create a batch command for removing the clip, track, and reindexing
            const remainingTracks = tracks.filter(t => t.id !== track.id)
            const reindexedTracks = remainingTracks.map((t, index) => ({
                ...t,
                index
            }))

            executeCommand({
                type: 'BATCH',
                payload: {
                    commands: [
                        // First remove the clip
                        {
                            type: 'REMOVE_CLIP',
                            payload: {
                                clip: selectedClip
                            }
                        },
                        // Then remove the track
                        {
                            type: 'REMOVE_TRACK',
                            payload: {
                                track,
                                affectedClips: []
                            }
                        },
                        // Then update each track's index
                        ...reindexedTracks.map(track => ({
                            type: 'UPDATE_TRACK' as const,
                            payload: {
                                before: tracks.find(t => t.id === track.id)!,
                                after: track
                            }
                        }))
                    ]
                }
            })
        } else {
            // Just remove the clip
            executeCommand({
                type: 'REMOVE_CLIP',
                payload: {
                    clip: selectedClip
                }
            })
        }

        // Clear selection after deletion
        setSelectedClipId(null)
    }

    // Keyboard event handler
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Only handle keyboard events if we're not in an input/textarea/contenteditable
            const target = e.target as HTMLElement
            if (target.tagName === 'INPUT' || 
                target.tagName === 'TEXTAREA' || 
                target.contentEditable === 'true') {
                return
            }

            // Handle Ctrl+Z (undo) and Ctrl+Shift+Z (redo)
            if (e.ctrlKey || e.metaKey) { // Support both Ctrl (Windows/Linux) and Cmd (Mac)
                if (e.shiftKey && e.key === 'Z') {
                    // Ctrl+Shift+Z = Redo
                    e.preventDefault()
                    if (canRedo) {
                        redo()
                    }
                    return
                } else if (e.key === 'z' || e.key === 'Z') {
                    // Ctrl+Z = Undo
                    e.preventDefault()
                    if (canUndo) {
                        undo()
                    }
                    return
                }
            }

            // Handle Backspace or Delete key
            if (e.key === 'Backspace' || e.key === 'Delete') {
                e.preventDefault()
                
                // Handle multiple selection deletion
                if (selectedClipIds && selectedClipIds.length > 0) {
                    handleDeleteMultipleSelectedClips()
                }
                // Handle single selection deletion (fallback)
                else if (selectedClipId) {
                    handleDeleteSelectedClip()
                }
            }
        }

        document.addEventListener('keydown', handleKeyDown)
        return () => {
            document.removeEventListener('keydown', handleKeyDown)
        }
    }, [selectedClipId, selectedClipIds, clips, tracks, executeCommand, setSelectedClipId, setSelectedClipIds, undo, redo, canUndo, canRedo])

    // Deselect clip on global click (outside any clip)
    useEffect(() => {
        const handleGlobalClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement
            
            // Don't interfere with clicks inside protected areas
            const protectedAreas = [
                '[data-menu-area]',
                '[data-clip-layer]', 
                '[data-text-tool-panel]',
                '[data-tool-panel]',
                '[data-project-name-editor]',
                '[data-assistant-panel]',
                'button',
                'input',
                'textarea'
            ]
            
            // Check if click is inside any protected area
            for (const selector of protectedAreas) {
                if (target.closest(selector)) {
                    return // Don't process this click
                }
            }
            
            // Only deselect clips if we're outside all protected areas
            setSelectedClipId(null)
        }
        document.addEventListener('click', handleGlobalClick, { capture: false })
        return () => {
            document.removeEventListener('click', handleGlobalClick)
        }
    }, [setSelectedClipId])

    // Ensure projectId is a string
    const projectId = Array.isArray(params.projectId) ? params.projectId[0] : params.projectId

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

    if (!project || !projectId) {
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
                <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-sm border border-gray-200/60 flex-shrink-0">
                    <ToolBar
                        selectedTool={selectedTool}
                        onToolSelect={handleToolSelect}
                    />
                </div>
                {selectedTool && (
                    <div className="w-96 bg-white/80 backdrop-blur-sm rounded-lg shadow-sm border border-gray-200/60 flex-shrink-0">
                        <ToolPanel />
                    </div>
                )}
                <div 
                    className="flex-1 bg-white/60 backdrop-blur-sm rounded-lg shadow-sm border border-gray-200/60 min-w-0"
                >
                    <EditorContent />
                </div>
                <div className="relative bg-white/80 backdrop-blur-sm rounded-lg shadow-sm border border-gray-200/60 flex-shrink-0" style={{ width: assistantWidth }} data-assistant-panel>
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