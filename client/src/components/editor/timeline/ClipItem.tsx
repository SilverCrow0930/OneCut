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
    isShiftDrag: boolean
    startY: number
    currentY: number
}

    const initialDragState: DragState = {
        isDragging: false,
        startX: 0,
        startLeft: 0,
        currentLeft: 0,
        ghostElement: null,
        dragOffset: 0,
        isOverlapping: false,
        targetTrackId: null,
        isShiftDrag: false,
        startY: 0,
        currentY: 0
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
    const [isShiftHeld, setIsShiftHeld] = useState(false)
    const dragAnimationRef = useRef<number | undefined>(undefined)
    const lastUpdateTime = useRef<number>(0)

    // Find the asset details
    const asset = assets.find(a => a.id === clip.assetId)
    const isVideo = clip.type === 'video' && clip.assetId
    const isImage = clip.type === 'image' && clip.assetId
    const isAudio = clip.type === 'audio' && clip.assetId
    const isText = clip.type === 'text'
    const isCaption = clip.type === 'caption'
    const isExternalAsset = clip.properties?.externalAsset
    const isVoiceover = isAudio && clip.properties?.isVoiceover
    // Remove the old transition detection
    // const isTransition = clip.properties?.isTransition === true
    
    // Add new transition detection
    const hasTransitionIn = !!clip.properties?.transitionIn
    const hasTransitionOut = !!clip.properties?.transitionOut
    const hasAnyTransition = hasTransitionIn || hasTransitionOut

    // Get the media URL - prioritize external asset URL over regular asset URL
    const externalAssetUrl = isExternalAsset?.url
    const mediaUrl = externalAssetUrl || url

    // Get the source duration
    const assetDuration = asset?.duration ?? isExternalAsset?.duration ?? 0
    
    // Calculate clip duration in milliseconds
    const durationMs = clip.timelineEndMs - clip.timelineStartMs

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
            
            // Simple overlap check - but this is just for visual feedback during drag
            if (!(newLeft + clipWidth <= otherLeft || newLeft >= otherRight)) {
                return true // Will trigger auto-insertion
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

    // Keyboard event listeners for Shift key tracking
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Shift') {
                setIsShiftHeld(true)
                document.body.style.cursor = 'move'
            }
        }

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Shift') {
                setIsShiftHeld(false)
                document.body.style.cursor = ''
            }
        }

        document.addEventListener('keydown', handleKeyDown)
        document.addEventListener('keyup', handleKeyUp)

        return () => {
            document.removeEventListener('keydown', handleKeyDown)
            document.removeEventListener('keyup', handleKeyUp)
            document.body.style.cursor = ''
        }
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

    // Thumbnail constants
    const MAX_THUMBNAILS = 8 // Increased for better coverage
    const thumbWidth = Math.max(width / MAX_THUMBNAILS, 24) // Minimum 24px per thumbnail
    const thumbHeight = '100%'

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

    // Keyboard event listeners for Shift key tracking
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Shift') {
                setIsShiftHeld(true)
                document.body.style.cursor = 'move'
            }
        }

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Shift') {
                setIsShiftHeld(false)
                document.body.style.cursor = ''
            }
        }

        document.addEventListener('keydown', handleKeyDown)
        document.addEventListener('keyup', handleKeyUp)

        return () => {
            document.removeEventListener('keydown', handleKeyDown)
            document.removeEventListener('keyup', handleKeyUp)
            document.body.style.cursor = ''
        }
    }, [])

    // HTML5 Drag and Drop handlers for moving between tracks (Shift+Drag)
    const handleDragStart = (e: React.DragEvent) => {
        // Only allow HTML5 drag when Shift is held
        if (!e.shiftKey) {
            e.preventDefault()
            return
        }

        e.dataTransfer.setData('application/json', JSON.stringify({
            clipId: clip.id
        }))
        e.dataTransfer.effectAllowed = 'move'

        // Create a custom drag image to avoid the default ghost
        if (clipRef.current) {
            const dragImage = clipRef.current.cloneNode(true) as HTMLElement
            dragImage.style.opacity = '0.8'
            dragImage.style.transform = 'rotate(2deg)'
            dragImage.style.border = '2px solid #3b82f6'
            document.body.appendChild(dragImage)
            e.dataTransfer.setDragImage(dragImage, e.nativeEvent.offsetX, e.nativeEvent.offsetY)
            setTimeout(() => document.body.removeChild(dragImage), 0)
        }
    }

    // Optimized mouse event handlers for dragging
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (isResizing || e.button !== 0) return // Only left mouse button

        // If Shift is held, we'll use HTML5 drag for track switching
        if (e.shiftKey) {
            // Don't prevent default - let HTML5 drag handle it
            return
        }

        // For regular drag (horizontal movement within same track)
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
            targetTrackId: clip.trackId,
            isShiftDrag: false,
            startY: e.clientY,
            currentY: e.clientY
        })

        // Add visual feedback class
        document.body.classList.add('cursor-grabbing')
        if (clipRef.current) {
            clipRef.current.style.zIndex = '1000'
            clipRef.current.style.opacity = '0.9'
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

        // Only update if position actually changed - REMOVED overlap check to enable auto-insertion
        if (Math.abs(dragState.currentLeft - dragState.startLeft) > 5) {
            const newStartMs = Math.round(dragState.currentLeft / timeScale)
            const durationMs = clip.timelineEndMs - clip.timelineStartMs
            const newEndMs = newStartMs + durationMs

            // Get all clips on the same track, excluding the current clip
            const trackClips = clips.filter(c => c.trackId === clip.trackId && c.id !== clip.id)
            
            // Create a map to track all clip positions (original and updated)
            const clipPositions = new Map<string, { startMs: number, endMs: number }>()
            
            // Initialize with original positions
            trackClips.forEach(c => {
                clipPositions.set(c.id, { startMs: c.timelineStartMs, endMs: c.timelineEndMs })
            })
            
            // Add our moving clip's new position
            clipPositions.set(clip.id, { startMs: newStartMs, endMs: newEndMs })
            
            // Find all clips that need to be shifted
            const clipsToUpdate: Array<{ before: Clip, after: Clip }> = []
            let finalNewStartMs = newStartMs
            
            // Sort all clips by their start time to process in order
            const sortedClips = [...trackClips].sort((a, b) => a.timelineStartMs - b.timelineStartMs)
            
            // Check each clip to see if it needs to be shifted
            for (const otherClip of sortedClips) {
                const currentPos = clipPositions.get(otherClip.id)!
                const ourPos = clipPositions.get(clip.id)!
                
                // If our clip overlaps with this clip
                if (ourPos.startMs < currentPos.endMs && ourPos.endMs > currentPos.startMs) {
                    
                    // Case 1: We're inserting before this clip - shift it forward
                    if (ourPos.startMs <= currentPos.startMs) {
                        const shiftAmount = ourPos.endMs - currentPos.startMs
                        const newStartMs = currentPos.startMs + shiftAmount
                        const newEndMs = currentPos.endMs + shiftAmount
                        
                        // Update the position map
                        clipPositions.set(otherClip.id, { startMs: newStartMs, endMs: newEndMs })
                        
                        // Add to update list
                        clipsToUpdate.push({
                            before: otherClip,
                            after: {
                                ...otherClip,
                                timelineStartMs: newStartMs,
                                timelineEndMs: newEndMs
                            }
                        })
                        
                        // Now check if this shifted clip overlaps with any clips that come after it
                        const laterClips = sortedClips.filter(c => c.timelineStartMs > otherClip.timelineStartMs)
                        for (const laterClip of laterClips) {
                            const laterPos = clipPositions.get(laterClip.id)!
                            
                            // If the shifted clip now overlaps with a later clip
                            if (newStartMs < laterPos.endMs && newEndMs > laterPos.startMs) {
                                const cascadeShiftAmount = newEndMs - laterPos.startMs
                                if (cascadeShiftAmount > 0) {
                                    const cascadeNewStartMs = laterPos.startMs + cascadeShiftAmount
                                    const cascadeNewEndMs = laterPos.endMs + cascadeShiftAmount
                                    
                                    // Update position map
                                    clipPositions.set(laterClip.id, { 
                                        startMs: cascadeNewStartMs, 
                                        endMs: cascadeNewEndMs 
                                    })
                                    
                                    // Add to update list (or update existing entry)
                                    const existingIndex = clipsToUpdate.findIndex(u => u.before.id === laterClip.id)
                                    if (existingIndex >= 0) {
                                        clipsToUpdate[existingIndex].after = {
                                            ...laterClip,
                                            timelineStartMs: cascadeNewStartMs,
                                            timelineEndMs: cascadeNewEndMs
                                        }
                                    } else {
                                        clipsToUpdate.push({
                                            before: laterClip,
                                            after: {
                                                ...laterClip,
                                                timelineStartMs: cascadeNewStartMs,
                                                timelineEndMs: cascadeNewEndMs
                                            }
                                        })
                                    }
                                }
                            }
                        }
                    }
                    // Case 2: We're inserting in the middle of this clip - snap to its end
                    else if (ourPos.startMs > currentPos.startMs && ourPos.startMs < currentPos.endMs) {
                        finalNewStartMs = currentPos.endMs
                        // Update our position in the map
                        clipPositions.set(clip.id, { 
                            startMs: finalNewStartMs, 
                            endMs: finalNewStartMs + durationMs 
                        })
                    }
                }
            }

            // Create the commands array
            const commands = []

            // Add the main clip move command
            commands.push({
                type: 'UPDATE_CLIP' as const,
                payload: {
                    before: clip,
                    after: {
                        ...clip,
                        timelineStartMs: finalNewStartMs,
                        timelineEndMs: finalNewStartMs + durationMs
                    }
                }
            })

            // Add all shift commands
            clipsToUpdate.forEach(update => {
                commands.push({
                    type: 'UPDATE_CLIP' as const,
                    payload: update
                })
            })

            // Execute all commands as a batch if there are multiple, or single command if just one
            if (commands.length > 1) {
                executeCommand({
                    type: 'BATCH',
                    payload: { commands }
                })
            } else {
                executeCommand(commands[0])
            }
        }

        setDragState(initialDragState)
    }, [dragState, clip, timeScale, executeCommand, clips])

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
                    ${dragState.isOverlapping ? 'border-blue-500 bg-blue-500/20 shadow-lg' : ''}
                    ${isPrimarySelection ? 'border-blue-400 shadow-md' : 
                      isInMultiSelection ? 'border-purple-400 shadow-sm' : 
                      'border-transparent hover:border-gray-400'}
                    ${isVoiceover ? 'bg-green-500 hover:bg-green-600' : !isVideo && !isImage ? 'bg-purple-500 hover:bg-purple-600' : ''}
                    ${isShiftHeld ? 'cursor-move border-blue-300 shadow-lg' : 'cursor-grab active:cursor-grabbing'}
                    select-none overflow-hidden
                `}
                style={{
                    left: `${left}px`,
                    width: `${Math.max(width, 20)}px`,
                    transform: dragState.isDragging ? 'translateY(-1px)' : 'translateY(0)',
                }}
                onClick={onClick}
                onContextMenu={handleContextMenu}
                onMouseDown={handleMouseDown}
                draggable={isShiftHeld} // Only enable HTML5 drag when Shift is held
                onDragStart={handleDragStart}
                title={isShiftHeld ? 'Hold Shift and drag to move between tracks' : 'Drag to move - overlapping clips will be automatically pushed forward'}
            >
                {/* Resize handles */}
                {selected && (
                    <>
                        <div
                            className="absolute left-0 top-0 w-2 h-full cursor-ew-resize hover:bg-white/20 transition-colors z-10"
                            onMouseDown={(e) => handleResizeStart(e, 'start')}
                        />
                        <div
                            className="absolute right-0 top-0 w-2 h-full cursor-ew-resize hover:bg-white/20 transition-colors z-10"
                            onMouseDown={(e) => handleResizeStart(e, 'end')}
                        />
                    </>
                )}

                {/* Enhanced Content based on type */}
                {isVideo && mediaUrl && (
                    <div className="w-full h-full overflow-hidden rounded-lg bg-gray-800 relative">
                        <div className="flex w-full h-full">
                            {Array.from({ length: Math.min(MAX_THUMBNAILS, Math.floor(width / 24)) }, (_, i) => (
                                <div
                                    key={i}
                                    className="flex-shrink-0 h-full bg-cover bg-center border-r border-gray-600 last:border-r-0"
                                    style={{
                                        width: `${thumbWidth}px`,
                                        backgroundImage: `url(${mediaUrl})`,
                                        backgroundSize: 'cover',
                                        backgroundPosition: 'center'
                                    }}
                                />
                            ))}
                        </div>
                        {/* Play icon overlay */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="bg-black/60 rounded-full p-1.5">
                                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                                </svg>
                            </div>
                        </div>
                        {/* Video label */}
                        <div className="absolute top-1 left-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
                            VIDEO
                        </div>
                        
                        {/* Transition indicators */}
                        {hasTransitionIn && (
                            <div className="absolute top-1 left-1/4 bg-purple-500/80 text-white text-xs px-1 py-0.5 rounded flex items-center gap-1">
                                <span>↗️</span>
                                <span className="text-xs">IN</span>
                            </div>
                        )}
                        {hasTransitionOut && (
                            <div className="absolute top-1 right-1/4 bg-purple-500/80 text-white text-xs px-1 py-0.5 rounded flex items-center gap-1">
                                <span>↘️</span>
                                <span className="text-xs">OUT</span>
                            </div>
                        )}
                                        </div>
                )}

                {isImage && mediaUrl && (
                    <div className="w-full h-full overflow-hidden rounded-lg bg-gray-800 relative">
                        <div
                            className="w-full h-full bg-cover bg-center"
                            style={{
                                backgroundImage: `url(${mediaUrl})`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center'
                            }}
                        />
                        {/* Image icon overlay */}
                        <div className="absolute top-1 right-1 bg-black/60 rounded p-1">
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                        {/* Image label */}
                        <div className="absolute top-1 left-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
                            IMAGE
                        </div>
                        
                        {/* Transition indicators */}
                        {hasTransitionIn && (
                            <div className="absolute top-1 left-1/4 bg-purple-500/80 text-white text-xs px-1 py-0.5 rounded flex items-center gap-1">
                                <span>↗️</span>
                                <span className="text-xs">IN</span>
                            </div>
                        )}
                        {hasTransitionOut && (
                            <div className="absolute top-1 right-1/4 bg-purple-500/80 text-white text-xs px-1 py-0.5 rounded flex items-center gap-1">
                                <span>↘️</span>
                                <span className="text-xs">OUT</span>
                            </div>
                        )}
                    </div>
                )}

                {isAudio && (
                    <div className="flex items-center justify-center w-full h-full relative">
                        {/* Enhanced audio visualization */}
                        <div className="flex items-center space-x-1">
                            {isVoiceover ? (
                                // Voiceover specific icon
                                <svg className="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                                </svg>
                            ) : (
                                // Regular audio icon
                                <svg className="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM15.657 6.343a1 1 0 011.414 0A9.972 9.972 0 0119 12a9.972 9.972 0 01-1.929 5.657 1 1 0 11-1.414-1.414A7.971 7.971 0 0017 12a7.971 7.971 0 00-1.343-4.243 1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                            )}
                            
                            {/* Audio waveform visualization */}
                            <div className="flex items-end space-x-0.5">
                                {Array.from({ length: Math.min(8, Math.floor(width / 20)) }, (_, i) => (
                                    <div
                                        key={i}
                                        className="bg-current opacity-60"
                                        style={{
                                            width: '2px',
                                            height: `${Math.random() * 12 + 4}px`,
                                            animation: `pulse ${1 + Math.random()}s ease-in-out infinite alternate`
                                        }}
                                    />
                                ))}
                            </div>
                        </div>
                        
                        {/* Audio label */}
                        <div className="absolute top-1 left-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
                            {isVoiceover ? 'VOICEOVER' : 'AUDIO'}
                        </div>
                        
                        {/* Duration for audio */}
                        <div className="absolute bottom-1 right-1 text-xs opacity-90">
                            {formatTime(durationMs)}
                        </div>
                    </div>
                )}

                {/* Duration indicator for video and image types */}
                {(isVideo || isImage) && (
                    <div className="absolute bottom-1 right-1 text-xs opacity-90 bg-black/60 px-1 rounded">
                    {formatTime(durationMs)}
                </div>
                )}

                {/* Multi-selection indicator */}
                {isInMultiSelection && (
                    <div className="absolute top-1 left-1 w-2 h-2 bg-purple-400 rounded-full" />
                )}

                {/* Enhanced transition border indicators */}
                {hasTransitionIn && (
                    <div className="absolute left-0 top-0 w-1 h-full bg-gradient-to-b from-purple-400 to-purple-600 rounded-l-lg" />
                )}
                {hasTransitionOut && (
                    <div className="absolute right-0 top-0 w-1 h-full bg-gradient-to-b from-purple-400 to-purple-600 rounded-r-lg" />
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
