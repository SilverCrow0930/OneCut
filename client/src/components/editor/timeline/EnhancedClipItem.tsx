import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useEditor } from '@/contexts/EditorContext'
import { usePlayback } from '@/contexts/PlaybackContext'
import { Clip, Command } from '@/types/editor'
import { getTimeScale } from '@/lib/constants'
import { useZoom } from '@/contexts/ZoomContext'
import { useAssetUrl } from '@/hooks/useAssetUrl'
import { useAssets } from '@/contexts/AssetsContext'
import { formatTime } from '@/lib/utils'
import { TimelineEngine, DebouncedCommandExecutor, defaultTimelineSettings } from '@/lib/editor/timelineUtils'
import TextClipItem from './TextClipItem'

interface EnhancedClipItemProps {
    clip: Clip
    onSelect: (id: string | null) => void
    selected: boolean
    timelineSettings?: typeof defaultTimelineSettings
}

export default function EnhancedClipItem({ 
    clip, 
    onSelect, 
    selected, 
    timelineSettings = defaultTimelineSettings 
}: EnhancedClipItemProps) {
    const { executeCommand, clips, tracks, selectedClipIds, setSelectedClipIds, setSelectedClipId } = useEditor()
    const { currentTime } = usePlayback()
    const { url } = useAssetUrl(clip.assetId)
    const { assets } = useAssets()
    const { zoomLevel } = useZoom()
    const timeScale = getTimeScale(zoomLevel)

    // Refs
    const clipRef = useRef<HTMLDivElement>(null)
    const dragStateRef = useRef({
        isDragging: false,
        startX: 0,
        startMs: 0,
        offset: 0,
        hasStarted: false
    })

    // State
    const [showContextMenu, setShowContextMenu] = useState(false)
    const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 })
    const [isResizing, setIsResizing] = useState(false)
    const [resizeType, setResizeType] = useState<'start' | 'end' | null>(null)
    const [dragPreview, setDragPreview] = useState<{
        visible: boolean
        left: number
        snapped: boolean
        snapType?: string
    }>({
        visible: false,
        left: 0,
        snapped: false
    })

    // Timeline engine for advanced operations
    const timelineEngine = useMemo(() => 
        new TimelineEngine(clips, tracks, timeScale), 
        [clips, tracks, timeScale]
    )

    // Debounced command executor for smooth updates
    const debouncedExecutor = useMemo(() => 
        new DebouncedCommandExecutor(executeCommand, 8), // 120fps for ultra-smooth updates
        [executeCommand]
    )

    // Asset info
    const asset = assets.find(a => a.id === clip.assetId)
    const isVideo = asset?.mime_type.startsWith('video/')
    const isImage = asset?.mime_type.startsWith('image/')
    const isAudio = asset?.mime_type.startsWith('audio/')
    const isText = clip.type === 'text' || clip.type === 'caption'

    // Positioning
    const left = clip.timelineStartMs * timeScale
    const width = (clip.timelineEndMs - clip.timelineStartMs) * timeScale

    // If it's a text clip, use the TextClipItem component
    if (isText) {
        return <TextClipItem clip={clip} />
    }

    // Enhanced drag start with immediate visual feedback
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.button !== 0 || isResizing) return // Only left mouse button

        e.preventDefault()
        e.stopPropagation()

        const rect = clipRef.current?.getBoundingClientRect()
        if (!rect) return

        // Select clip immediately
        if (e.ctrlKey || e.metaKey) {
            const isCurrentlySelected = selectedClipIds.includes(clip.id)
            if (isCurrentlySelected) {
                const newSelection = selectedClipIds.filter(id => id !== clip.id)
                setSelectedClipIds(newSelection)
                if (newSelection.length === 1) {
                    setSelectedClipId(newSelection[0])
                } else {
                    setSelectedClipId(null)
                }
            } else {
                const newSelection = [...selectedClipIds, clip.id]
                setSelectedClipIds(newSelection)
                setSelectedClipId(clip.id)
            }
        } else {
            setSelectedClipIds([clip.id])
            setSelectedClipId(clip.id)
            onSelect(clip.id)
        }

        // Initialize drag state
        dragStateRef.current = {
            isDragging: true,
            startX: e.clientX,
            startMs: clip.timelineStartMs,
            offset: e.clientX - rect.left,
            hasStarted: false
        }

        // Show drag preview immediately
        setDragPreview({
            visible: true,
            left: left,
            snapped: false
        })

        // Add global mouse listeners
        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)
        document.body.style.cursor = 'grabbing'
        document.body.style.userSelect = 'none'

    }, [clip, selectedClipIds, setSelectedClipIds, setSelectedClipId, onSelect, left, isResizing])

    // Real-time drag movement with magnetic snapping
    const handleMouseMove = useCallback((e: MouseEvent) => {
        const dragState = dragStateRef.current
        if (!dragState.isDragging) return

        const deltaX = e.clientX - dragState.startX
        
        // Start dragging after minimum movement to prevent accidental drags
        if (!dragState.hasStarted && Math.abs(deltaX) < 3) return
        
        if (!dragState.hasStarted) {
            dragState.hasStarted = true
        }

        // Calculate new position
        const newLeft = Math.max(0, left + deltaX)
        const newStartMs = Math.round(newLeft / timeScale)

        // Generate snap points
        const snapPoints = timelineEngine.generateSnapPoints(
            clip.id, 
            timelineSettings.magneticSnapping ? currentTime * 1000 : undefined
        )

        // Find snap position
        const snapResult = timelineEngine.findSnapPosition(newLeft, snapPoints)
        const finalLeft = snapResult.position
        const finalStartMs = Math.round(finalLeft / timeScale)

        // Check for collisions
        const clipDuration = clip.timelineEndMs - clip.timelineStartMs
        const collisions = timelineEngine.checkCollisions(
            clip.id, 
            finalStartMs, 
            finalStartMs + clipDuration, 
            clip.trackId!
        )

        // Update drag preview
        setDragPreview({
            visible: true,
            left: finalLeft,
            snapped: snapResult.snapped,
            snapType: snapResult.snapPoint?.type
        })

        // Real-time position update (visual only, not committed)
        if (collisions.length === 0 && timelineSettings.magneticSnapping) {
            // Update clip position in real-time for smooth feedback
            debouncedExecutor.execute({
                type: 'UPDATE_CLIP',
                payload: {
                    before: clip,
                    after: {
                        ...clip,
                        timelineStartMs: finalStartMs,
                        timelineEndMs: finalStartMs + clipDuration
                    }
                }
            } as Command)
        }

    }, [clip, timeScale, left, currentTime, timelineEngine, timelineSettings, debouncedExecutor])

    // Enhanced drag end with gap closure and ripple editing
    const handleMouseUp = useCallback((e: MouseEvent) => {
        const dragState = dragStateRef.current
        if (!dragState.isDragging) return

        // Clean up
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''

        dragStateRef.current.isDragging = false
        setDragPreview({ visible: false, left: 0, snapped: false })

        // Only commit if drag actually started
        if (!dragState.hasStarted) return

        const deltaX = e.clientX - dragState.startX
        const newLeft = Math.max(0, left + deltaX)
        const newStartMs = Math.round(newLeft / timeScale)

        // Generate snap points and find final position
        const snapPoints = timelineEngine.generateSnapPoints(
            clip.id, 
            timelineSettings.magneticSnapping ? currentTime * 1000 : undefined
        )
        const snapResult = timelineEngine.findSnapPosition(newLeft, snapPoints)
        const finalStartMs = Math.round(snapResult.position / timeScale)
        const clipDuration = clip.timelineEndMs - clip.timelineStartMs

        // Check for collisions
        const collisions = timelineEngine.checkCollisions(
            clip.id, 
            finalStartMs, 
            finalStartMs + clipDuration, 
            clip.trackId!
        )

        if (collisions.length > 0) {
            // Revert to original position if collision
            console.log('Collision detected, reverting position')
            return
        }

        // Commit the final position
        const commands: Command[] = []

        // Main move command
        commands.push({
            type: 'UPDATE_CLIP',
            payload: {
                before: clip,
                after: {
                    ...clip,
                    timelineStartMs: finalStartMs,
                    timelineEndMs: finalStartMs + clipDuration
                }
            }
        } as Command)

        // Add ripple commands if enabled
        if (timelineSettings.rippleEdit) {
            const rippleCommands = timelineEngine.generateRippleCommands(
                clip, 
                finalStartMs, 
                'right'
            )
            commands.push(...rippleCommands)
        }

        // Execute all commands
        if (commands.length === 1) {
            executeCommand(commands[0])
        } else {
            executeCommand({
                type: 'BATCH',
                payload: { commands }
            } as Command)
        }

    }, [clip, left, timeScale, currentTime, timelineEngine, timelineSettings, executeCommand, handleMouseMove])

    // Enhanced delete with gap closure
    const handleDelete = useCallback(() => {
        const commands: Command[] = []

        // Remove clip command
        commands.push({
            type: 'REMOVE_CLIP',
            payload: { clip }
        } as Command)

        // Add gap closure commands if enabled
        if (timelineSettings.autoCloseGaps) {
            const gapCommands = timelineEngine.generateGapClosureCommands(clip, true)
            commands.push(...gapCommands)
        }

        // Check if track becomes empty
        const remainingClipsInTrack = clips.filter(c => c.trackId === clip.trackId && c.id !== clip.id)
        if (remainingClipsInTrack.length === 0) {
            const track = tracks.find(t => t.id === clip.trackId)
            if (track) {
                commands.push({
                    type: 'REMOVE_TRACK',
                    payload: { track, affectedClips: [] }
                } as Command)

                // Reindex remaining tracks
                const remainingTracks = tracks.filter(t => t.id !== track.id)
                remainingTracks.forEach((t, index) => {
                    commands.push({
                        type: 'UPDATE_TRACK',
                        payload: {
                            before: t,
                            after: { ...t, index }
                        }
                    } as Command)
                })
            }
        }

        // Execute all commands
        if (commands.length === 1) {
            executeCommand(commands[0])
        } else {
            executeCommand({
                type: 'BATCH',
                payload: { commands }
            } as Command)
        }

        setShowContextMenu(false)
    }, [clip, clips, tracks, timelineEngine, timelineSettings, executeCommand])

    // Context menu
    const handleContextMenu = useCallback((e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setContextMenuPosition({ x: e.clientX, y: e.clientY })
        setShowContextMenu(true)
    }, [])

    // Close context menu
    useEffect(() => {
        const handleClickOutside = () => setShowContextMenu(false)
        if (showContextMenu) {
            document.addEventListener('click', handleClickOutside)
            return () => document.removeEventListener('click', handleClickOutside)
        }
    }, [showContextMenu])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            debouncedExecutor.cancel()
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
        }
    }, [debouncedExecutor, handleMouseMove, handleMouseUp])

    // Selection state
    const isInMultiSelection = selectedClipIds.includes(clip.id)
    const isMultiSelectionActive = selectedClipIds.length > 1
    const isPrimarySelection = selected && !isMultiSelectionActive

    // Visual feedback classes
    const clipClasses = [
        'absolute h-full text-white text-xs flex items-center justify-center rounded-lg',
        'transition-all duration-75 ease-out', // Smooth transitions
        'hover:brightness-110 cursor-grab active:cursor-grabbing',
        'border-2 border-transparent',
        // Selection states
        isPrimarySelection && 'ring-2 ring-blue-400 ring-offset-1',
        isInMultiSelection && !isPrimarySelection && 'ring-2 ring-blue-300 ring-offset-1',
        // Drag state
        dragPreview.visible && 'opacity-50',
        // Snap feedback
        dragPreview.snapped && 'ring-2 ring-green-400',
        // Content type styling
        isVideo && 'bg-blue-500 hover:bg-blue-600',
        isAudio && 'bg-green-500 hover:bg-green-600',
        isImage && 'bg-purple-500 hover:bg-purple-600'
    ].filter(Boolean).join(' ')

    return (
        <>
            {/* Main clip */}
            <div
                ref={clipRef}
                data-clip-layer
                data-timeline-clip
                data-clip-id={clip.id}
                className={clipClasses}
                style={{
                    left: `${left}px`,
                    width: `${Math.max(width, 20)}px`,
                    zIndex: selected ? 10 : 1
                }}
                onMouseDown={handleMouseDown}
                onContextMenu={handleContextMenu}
            >
                {/* Content preview */}
                <div className="flex items-center justify-center w-full h-full overflow-hidden">
                    {isVideo && url && (
                        <video
                            src={url}
                            className="w-full h-full object-cover rounded"
                            muted
                            preload="metadata"
                        />
                    )}
                    {isImage && url && (
                        <img
                            src={url}
                            alt="Clip preview"
                            className="w-full h-full object-cover rounded"
                        />
                    )}
                    {isAudio && (
                        <div className="flex items-center justify-center">
                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                            </svg>
                        </div>
                    )}
                </div>

                {/* Clip info overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-xs p-1 rounded-b">
                    <div className="truncate">
                        {asset?.name || 'Unnamed'}
                    </div>
                    <div className="text-gray-300">
                        {formatTime((clip.timelineEndMs - clip.timelineStartMs) / 1000)}
                    </div>
                </div>

                {/* Resize handles */}
                <div
                    className="absolute left-0 top-0 w-2 h-full cursor-ew-resize bg-transparent hover:bg-white hover:bg-opacity-20"
                    onMouseDown={(e) => handleResizeStart(e, 'start')}
                />
                <div
                    className="absolute right-0 top-0 w-2 h-full cursor-ew-resize bg-transparent hover:bg-white hover:bg-opacity-20"
                    onMouseDown={(e) => handleResizeStart(e, 'end')}
                />
            </div>

            {/* Drag preview ghost */}
            {dragPreview.visible && (
                <div
                    className={[
                        'absolute h-full rounded-lg pointer-events-none',
                        'border-2 border-dashed',
                        dragPreview.snapped ? 'border-green-400 bg-green-400 bg-opacity-20' : 'border-blue-400 bg-blue-400 bg-opacity-20',
                        'transition-all duration-75 ease-out'
                    ].join(' ')}
                    style={{
                        left: `${dragPreview.left}px`,
                        width: `${Math.max(width, 20)}px`,
                        zIndex: 20
                    }}
                >
                    {dragPreview.snapped && (
                        <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 bg-green-500 text-white text-xs px-2 py-1 rounded">
                            {dragPreview.snapType === 'grid' ? 'Grid' : 
                             dragPreview.snapType === 'clip-start' ? 'Clip Start' :
                             dragPreview.snapType === 'clip-end' ? 'Clip End' :
                             dragPreview.snapType === 'playhead' ? 'Playhead' : 'Snap'}
                        </div>
                    )}
                </div>
            )}

            {/* Context menu */}
            {showContextMenu && (
                <div
                    className="fixed bg-white rounded-lg shadow-lg border py-2 z-50"
                    style={{
                        left: contextMenuPosition.x,
                        top: contextMenuPosition.y
                    }}
                >
                    <button
                        className="w-full px-4 py-2 text-left hover:bg-gray-100 text-red-600"
                        onClick={handleDelete}
                    >
                        Delete Clip
                    </button>
                    <button
                        className="w-full px-4 py-2 text-left hover:bg-gray-100"
                        onClick={() => {
                            // TODO: Implement duplicate
                            setShowContextMenu(false)
                        }}
                    >
                        Duplicate
                    </button>
                    <button
                        className="w-full px-4 py-2 text-left hover:bg-gray-100"
                        onClick={() => {
                            // TODO: Implement split
                            setShowContextMenu(false)
                        }}
                    >
                        Split at Playhead
                    </button>
                </div>
            )}
        </>
    )

    // Placeholder resize functions (to be implemented)
    function handleResizeStart(e: React.MouseEvent, type: 'start' | 'end') {
        e.preventDefault()
        e.stopPropagation()
        // TODO: Implement enhanced resize with snapping
        console.log('Resize start:', type)
    }
}
