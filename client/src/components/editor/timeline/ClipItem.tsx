import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useEditor } from '@/contexts/EditorContext'
import { Clip } from '@/types/editor'
import { getTimeScale } from '@/lib/constants'
import { useZoom } from '@/contexts/ZoomContext'
import { useAssetUrl } from '@/hooks/useAssetUrl'
import { useAssets } from '@/contexts/AssetsContext'
import { formatTime } from '@/lib/utils'
import TextClipItem from './TextClipItem'

// Optimized drag state management
interface DragState {
    isDragging: boolean
    startX: number
    startLeft: number
    currentLeft: number
    ghostElement: HTMLElement | null
    dragOffset: number
    isOverlapping: boolean
    targetTrackId: string | null
}

const initialDragState: DragState = {
    isDragging: false,
    startX: 0,
    startLeft: 0,
    currentLeft: 0,
    ghostElement: null,
    dragOffset: 0,
    isOverlapping: false,
    targetTrackId: null
}

export default function ClipItem({ clip, onSelect, selected }: { clip: Clip, onSelect: (id: string | null) => void, selected: boolean }) {
    const { executeCommand, clips, tracks, selectedClipIds, setSelectedClipIds, setSelectedClipId } = useEditor()
    const { url } = useAssetUrl(clip.assetId)
    const { assets } = useAssets()
    const { zoomLevel } = useZoom()
    const timeScale = getTimeScale(zoomLevel)

    // context menu state
    const [showContextMenu, setShowContextMenu] = useState(false)
    const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 })

    // resize state
    const [isResizing, setIsResizing] = useState(false)
    const [resizeType, setResizeType] = useState<'start' | 'end' | null>(null)
    const [resizeStartX, setResizeStartX] = useState(0)
    const [resizeStartMs, setResizeStartMs] = useState(0)
    const [currentLeft, setCurrentLeft] = useState(0)
    const [currentWidth, setCurrentWidth] = useState(0)
    const clipRef = useRef<HTMLDivElement>(null)

    // Optimized drag state
    const [dragState, setDragState] = useState<DragState>(initialDragState)
    const dragAnimationRef = useRef<number | undefined>(undefined)
    const lastUpdateTime = useRef<number>(0)

    // Find the asset details
    const asset = assets.find(a => a.id === clip.assetId)
    const isVideo = asset?.mime_type.startsWith('video/')
    const isImage = asset?.mime_type.startsWith('image/')
    const isAudio = asset?.mime_type.startsWith('audio/')
    const isText = clip.type === 'text' || clip.type === 'caption'

    // Get the source duration
    const assetDuration = asset?.duration ?? 0

    // convert ms → px with optimized calculation
    const left = isResizing ? currentLeft : 
                 dragState.isDragging ? dragState.currentLeft : 
                 clip.timelineStartMs * timeScale
    const width = isResizing ? currentWidth : (clip.timelineEndMs - clip.timelineStartMs) * timeScale

    // If it's a text clip, use the TextClipItem component
    if (isText) {
        return <TextClipItem clip={clip} />
    }

    // Optimized collision detection with memoization
    const checkCollisions = useCallback((newLeft: number, clipWidth: number, trackId: string) => {
        const otherClips = clips.filter(c => c.trackId === trackId && c.id !== clip.id)
        
        for (const otherClip of otherClips) {
            const otherLeft = otherClip.timelineStartMs * timeScale
            const otherRight = otherClip.timelineEndMs * timeScale
            
            // Simple overlap check
            if (!(newLeft + clipWidth <= otherLeft || newLeft >= otherRight)) {
                return true // Overlapping
            }
        }
        return false
    }, [clips, clip.id, timeScale])

    // Optimized snapping with reduced calculations
    const calculateSnappedPosition = useCallback((rawLeft: number, clipWidth: number, trackId: string) => {
        // Reduced grid snap for smoother movement
        const gridSnapMs = 100 // Reduced from 500ms to 100ms
        const gridSnapPixels = gridSnapMs * timeScale
        
        // Grid snap
        let snappedLeft = Math.round(rawLeft / gridSnapPixels) * gridSnapPixels
        
        // Clip edge snapping (only check nearby clips for performance)
        const snapDistance = 12 // Slightly increased for easier snapping
        const otherClips = clips.filter(c => c.trackId === trackId && c.id !== clip.id)
        
        for (const otherClip of otherClips) {
            const otherLeft = otherClip.timelineStartMs * timeScale
            const otherRight = otherClip.timelineEndMs * timeScale
            
            // Only check clips that are reasonably close
            if (Math.abs(rawLeft - otherLeft) < 100 || Math.abs(rawLeft - otherRight) < 100) {
                // Snap to left edge
                if (Math.abs(snappedLeft - otherLeft) < snapDistance) {
                    snappedLeft = otherLeft
                    break
                }
                // Snap to right edge
                else if (Math.abs(snappedLeft - otherRight) < snapDistance) {
                    snappedLeft = otherRight
                    break
                }
                // Snap our right edge to their left edge
                else if (Math.abs((snappedLeft + clipWidth) - otherLeft) < snapDistance) {
                    snappedLeft = otherLeft - clipWidth
                    break
                }
                // Snap our left edge to their right edge
                else if (Math.abs(snappedLeft - otherRight) < snapDistance) {
                    snappedLeft = otherRight
                    break
                }
            }
        }
        
        return Math.max(0, snappedLeft)
    }, [clips, clip.id, timeScale])

    // Throttled drag update for better performance
    const updateDragPosition = useCallback((clientX: number) => {
        const now = performance.now()
        if (now - lastUpdateTime.current < 16) return // Throttle to ~60fps
        lastUpdateTime.current = now

        if (!clipRef.current || !dragState.isDragging) return

        const timelineContainer = clipRef.current.closest('.timeline-container')
        if (!timelineContainer) return

        const timelineRect = timelineContainer.getBoundingClientRect()
        const rawLeft = clientX - timelineRect.left - dragState.dragOffset
        const clipWidth = width
        
        const snappedLeft = calculateSnappedPosition(rawLeft, clipWidth, clip.trackId)
        const isOverlapping = checkCollisions(snappedLeft, clipWidth, clip.trackId)

        setDragState(prev => ({
            ...prev,
            currentLeft: snappedLeft,
            isOverlapping
        }))
    }, [dragState.isDragging, dragState.dragOffset, width, clip.trackId, calculateSnappedPosition, checkCollisions])

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setContextMenuPosition({ x: e.clientX, y: e.clientY })
        setShowContextMenu(true)
    }

    const handleDelete = () => {
        // First remove the clip
        executeCommand({
            type: 'REMOVE_CLIP',
            payload: {
                clip
            }
        })

        // Check if the track becomes empty after removing this clip
        const remainingClipsInTrack = clips.filter(c => c.trackId === clip.trackId && c.id !== clip.id)
        if (remainingClipsInTrack.length === 0) {
            // Find the track
            const track = tracks.find(t => t.id === clip.trackId)
            if (track) {
                // Remove the track
                executeCommand({
                    type: 'REMOVE_TRACK',
                    payload: {
                        track,
                        affectedClips: []
                    }
                })

                // Reindex remaining tracks
                const remainingTracks = tracks.filter(t => t.id !== track.id)
                const reindexedTracks = remainingTracks.map((t, index) => ({
                    ...t,
                    index
                }))

                // Update each track's index
                reindexedTracks.forEach(track => {
                    executeCommand({
                        type: 'UPDATE_TRACK',
                        payload: {
                            before: tracks.find(t => t.id === track.id)!,
                            after: track
                        }
                    })
                })
            }
        }

        setShowContextMenu(false)
    }

    // Close context menu when clicking outside
    useEffect(() => {
        const handleClickOutside = () => setShowContextMenu(false)
        document.addEventListener('click', handleClickOutside)
        return () => document.removeEventListener('click', handleClickOutside)
    }, [])

    // click handler to select
    const onClick = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        
        // Handle multi-selection with Ctrl/Cmd key
        if (e.ctrlKey || e.metaKey) {
            const isCurrentlySelected = selectedClipIds.includes(clip.id)
            if (isCurrentlySelected) {
                // Remove from selection
                const newSelection = selectedClipIds.filter(id => id !== clip.id)
                setSelectedClipIds(newSelection)
                if (newSelection.length === 1) {
                    setSelectedClipId(newSelection[0])
                } else {
                    setSelectedClipId(null)
                }
            } else {
                // Add to selection
                const newSelection = [...selectedClipIds, clip.id]
                setSelectedClipIds(newSelection)
                setSelectedClipId(clip.id) // Set as primary selection
            }
        } else {
            // Normal single selection
            setSelectedClipIds([clip.id])
            setSelectedClipId(clip.id)
            onSelect(clip.id)
        }
    }

    // Limit the number of thumbnails to prevent performance issues
    const MAX_THUMBNAILS = 4
    const thumbWidth = Math.max(width / MAX_THUMBNAILS, 32)
    const thumbHeight = '100%'

    // Calculate duration in milliseconds
    const durationMs = clip.timelineEndMs - clip.timelineStartMs

    const handleResizeStart = (e: React.MouseEvent, type: 'start' | 'end') => {
        e.preventDefault()
        e.stopPropagation()
        setIsResizing(true)
        setResizeType(type)
        setResizeStartX(e.clientX)
        setResizeStartMs(type === 'start' ? clip.timelineStartMs : clip.timelineEndMs)
        setCurrentLeft(clip.timelineStartMs * timeScale)
        setCurrentWidth((clip.timelineEndMs - clip.timelineStartMs) * timeScale)
        document.body.classList.add('cursor-ew-resize')
    }

    const handleResizeMove = (e: MouseEvent) => {
        if (!isResizing || !resizeType || !clipRef.current) return

        const deltaX = e.clientX - resizeStartX
        const deltaMs = Math.round(deltaX / timeScale)

        if (resizeType === 'start') {
            // Calculate new start time with constraints
            const minStartMs = 0 // Can't go before timeline start
            const maxStartMs = clip.timelineEndMs - 100 // Minimum 100ms duration

            // Calculate source time proportionally
            const timelineRatio = (resizeStartMs + deltaMs - clip.timelineStartMs) / (clip.timelineEndMs - clip.timelineStartMs)
            const sourceDuration = clip.sourceEndMs - clip.sourceStartMs
            const newSourceStartMs = Math.round(clip.sourceStartMs + (sourceDuration * timelineRatio))

            // Only prevent moving left if source start is 0
            let newStartMs = resizeStartMs + deltaMs
            if (clip.sourceStartMs === 0 && newSourceStartMs < clip.sourceStartMs) {
                newStartMs = clip.timelineStartMs
            }

            // Apply minimum duration constraint
            newStartMs = Math.max(minStartMs, Math.min(newStartMs, maxStartMs))

            // Update visual position and width directly
            setCurrentLeft(newStartMs * timeScale)
            setCurrentWidth((clip.timelineEndMs - newStartMs) * timeScale)
        } else {
            // Calculate new end time with constraints
            const minEndMs = clip.timelineStartMs + 100 // Minimum 100ms duration
            const maxEndMs = clip.timelineStartMs + (assetDuration - clip.sourceStartMs) // Can't exceed asset duration

            let newEndMs = resizeStartMs + deltaMs
            newEndMs = Math.max(minEndMs, Math.min(newEndMs, maxEndMs))

            // Update visual width directly
            setCurrentWidth((newEndMs - clip.timelineStartMs) * timeScale)
        }
    }

    const handleResizeEnd = (e: MouseEvent) => {
        if (!isResizing || !resizeType) return

        const deltaX = e.clientX - resizeStartX
        const deltaMs = Math.round(deltaX / timeScale)

        if (resizeType === 'start') {
            const minStartMs = 0
            const maxStartMs = clip.timelineEndMs - 100

            let newStartMs = resizeStartMs + deltaMs
            if (clip.sourceStartMs === 0) {
                const timelineRatio = (newStartMs - clip.timelineStartMs) / (clip.timelineEndMs - clip.timelineStartMs)
            const sourceDuration = clip.sourceEndMs - clip.sourceStartMs
                const newSourceStartMs = Math.round(clip.sourceStartMs + (sourceDuration * timelineRatio))
                if (newSourceStartMs < clip.sourceStartMs) {
                newStartMs = clip.timelineStartMs
                }
            }

            newStartMs = Math.max(minStartMs, Math.min(newStartMs, maxStartMs))

            const newSourceStartMs = Math.round(clip.sourceStartMs + ((newStartMs - clip.timelineStartMs) / (clip.timelineEndMs - clip.timelineStartMs)) * (clip.sourceEndMs - clip.sourceStartMs))

            executeCommand({
                type: 'UPDATE_CLIP',
                payload: {
                    before: clip,
                    after: {
                        ...clip,
                        timelineStartMs: newStartMs,
                        sourceStartMs: Math.max(0, newSourceStartMs)
                    }
                }
            })
        } else {
            const minEndMs = clip.timelineStartMs + 100
            const maxEndMs = clip.timelineStartMs + (assetDuration - clip.sourceStartMs)

            let newEndMs = resizeStartMs + deltaMs
            newEndMs = Math.max(minEndMs, Math.min(newEndMs, maxEndMs))

            const newSourceEndMs = Math.round(clip.sourceStartMs + (newEndMs - clip.timelineStartMs))

        executeCommand({
            type: 'UPDATE_CLIP',
            payload: {
                before: clip,
                after: {
                    ...clip,
                    timelineEndMs: newEndMs,
                        sourceEndMs: Math.min(assetDuration, newSourceEndMs)
                    }
                }
            })
            }

        setIsResizing(false)
        setResizeType(null)
        document.body.classList.remove('cursor-ew-resize')
    }

    // Optimized mouse event handlers for dragging
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (isResizing || e.button !== 0) return // Only left mouse button

        e.preventDefault()
        e.stopPropagation()

        if (!clipRef.current) return

        const rect = clipRef.current.getBoundingClientRect()
        const offset = e.clientX - rect.left

        setDragState({
            isDragging: true,
            startX: e.clientX,
            startLeft: left,
            currentLeft: left,
            ghostElement: null,
            dragOffset: offset,
            isOverlapping: false,
            targetTrackId: clip.trackId
        })

        // Add visual feedback class
        document.body.classList.add('cursor-grabbing')
        if (clipRef.current) {
            clipRef.current.style.zIndex = '1000'
            clipRef.current.style.opacity = '0.8'
        }
    }, [isResizing, left, clip.trackId])

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!dragState.isDragging) return
        updateDragPosition(e.clientX)
    }, [dragState.isDragging, updateDragPosition])

    const handleMouseUp = useCallback((e: MouseEvent) => {
        if (!dragState.isDragging) return

        // Remove visual feedback
        document.body.classList.remove('cursor-grabbing')
        if (clipRef.current) {
            clipRef.current.style.zIndex = ''
            clipRef.current.style.opacity = ''
        }

        // Only update if position actually changed and not overlapping
        if (!dragState.isOverlapping && Math.abs(dragState.currentLeft - dragState.startLeft) > 5) {
            const newStartMs = Math.round(dragState.currentLeft / timeScale)
            const durationMs = clip.timelineEndMs - clip.timelineStartMs

        executeCommand({
            type: 'UPDATE_CLIP',
            payload: {
                    before: clip,
                after: {
                        ...clip,
                    timelineStartMs: newStartMs,
                    timelineEndMs: newStartMs + durationMs
                }
            }
        })
        }

        setDragState(initialDragState)
    }, [dragState, clip, timeScale, executeCommand])

    // Mouse event listeners
    useEffect(() => {
        if (!dragState.isDragging) return

        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)

        return () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
        }
    }, [dragState.isDragging, handleMouseMove, handleMouseUp])

    // Resize event listeners
    useEffect(() => {
        if (!isResizing) return

        document.addEventListener('mousemove', handleResizeMove)
        document.addEventListener('mouseup', handleResizeEnd)

        return () => {
            document.removeEventListener('mousemove', handleResizeMove)
            document.removeEventListener('mouseup', handleResizeEnd)
        }
    }, [isResizing])

    // Selection state
    const isInMultiSelection = selectedClipIds.includes(clip.id)
    const isMultiSelectionActive = selectedClipIds.length > 1
    const isPrimarySelection = selected && !isMultiSelectionActive

    return (
        <>
            <div
                ref={clipRef}
                data-clip-layer
                data-timeline-clip
                data-clip-id={clip.id}
                className={`
                    absolute h-full text-white text-xs
                    flex items-center justify-center rounded-lg
                    border-2 transition-all duration-75
                    ${dragState.isDragging ? 'shadow-lg scale-105' : ''}
                    ${dragState.isOverlapping ? 'border-red-500 bg-red-500/20' : ''}
                    ${isPrimarySelection ? 'border-blue-400 shadow-md' : 
                      isInMultiSelection ? 'border-purple-400 shadow-sm' : 
                      'border-transparent hover:border-gray-400'}
                    ${isVideo ? 'bg-blue-500 hover:bg-blue-600' : 
                      isAudio ? 'bg-green-500 hover:bg-green-600' : 
                      'bg-purple-500 hover:bg-purple-600'}
                    cursor-grab active:cursor-grabbing
                    select-none overflow-hidden
                `}
                style={{
                    left: `${left}px`,
                    width: `${Math.max(width, 20)}px`,
                    transform: dragState.isDragging ? 'translateY(-2px)' : 'translateY(0)',
                }}
                onClick={onClick}
                onContextMenu={handleContextMenu}
                onMouseDown={handleMouseDown}
                draggable={false} // Disable HTML5 drag to use custom mouse events
            >
                {/* Resize handles */}
                <div
                    className="absolute left-0 top-0 w-2 h-full cursor-ew-resize hover:bg-white/20 transition-colors"
                    onMouseDown={(e) => handleResizeStart(e, 'start')}
                />
                <div
                    className="absolute right-0 top-0 w-2 h-full cursor-ew-resize hover:bg-white/20 transition-colors"
                    onMouseDown={(e) => handleResizeStart(e, 'end')}
                />

                {/* Content based on type */}
                {isVideo && url && (
                    <div className="flex items-center justify-center w-full h-full overflow-hidden">
                        {Array.from({ length: Math.min(MAX_THUMBNAILS, Math.floor(width / 32)) }, (_, i) => (
                            <div
                                key={i}
                                className="flex-shrink-0 h-full bg-cover bg-center"
                                        style={{
                                    width: `${thumbWidth}px`,
                                            backgroundImage: `url(${url})`,
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center'
                                }}
                            />
                        ))}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                            </svg>
                        </div>
                </div>
                )}

                {isImage && url && (
                    <div
                        className="w-full h-full bg-cover bg-center"
                        style={{
                            backgroundImage: `url(${url})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center'
                        }}
                    />
                )}

                {isAudio && (
                    <div className="flex items-center justify-center w-full h-full">
                        <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM15.657 6.343a1 1 0 011.414 0A9.972 9.972 0 0119 12a9.972 9.972 0 01-1.929 5.657 1 1 0 11-1.414-1.414A7.971 7.971 0 0017 12a7.971 7.971 0 00-1.343-4.243 1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                        <span className="text-xs truncate">{formatTime(durationMs)}</span>
                    </div>
                )}

                {/* Duration indicator for all types */}
                <div className="absolute bottom-0 right-1 text-xs opacity-75 bg-black/50 px-1 rounded">
                    {formatTime(durationMs)}
                </div>

                {/* Multi-selection indicator */}
                {isInMultiSelection && (
                    <div className="absolute top-1 left-1 w-2 h-2 bg-purple-400 rounded-full" />
                )}
            </div>

            {/* Context Menu */}
            {showContextMenu && (
                    <div
                    className="fixed bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50"
                        style={{
                            left: contextMenuPosition.x,
                        top: contextMenuPosition.y
                        }}
                    >
                        <button
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 text-red-600"
                            onClick={handleDelete}
                        >
                            Delete Clip
                        </button>
                    </div>
            )}
        </>
    )
}
