import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Clip } from '@/types/editor'
import { getTimeScale } from '@/lib/constants'
import { useZoom } from '@/contexts/ZoomContext'
import { useEditor } from '@/contexts/EditorContext'
import { formatTime } from '@/lib/utils'

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

export default function TextClipItem({ clip }: { clip: Clip }) {
    const { zoomLevel } = useZoom()
    const { selectedClipIds, setSelectedClipIds, setSelectedClipId, executeCommand, clips } = useEditor()
    const timeScale = getTimeScale(zoomLevel)
    const [showContextMenu, setShowContextMenu] = useState(false)
    const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 })
    const [isShiftHeld, setIsShiftHeld] = useState(false)
    const clipRef = useRef<HTMLDivElement>(null)
    const lastUpdateTime = useRef<number>(0)

    // Drag state
    const [dragState, setDragState] = useState<DragState>(initialDragState)

    // Resize state
    const [isResizing, setIsResizing] = useState(false)
    const [resizeType, setResizeType] = useState<'start' | 'end' | null>(null)
    const [resizeStartX, setResizeStartX] = useState(0)
    const [resizeStartMs, setResizeStartMs] = useState(0)
    const [currentLeft, setCurrentLeft] = useState(0)
    const [currentWidth, setCurrentWidth] = useState(0)

    // convert ms → px
    const left = isResizing ? currentLeft : 
                dragState.isDragging ? dragState.currentLeft : 
                clip.timelineStartMs * timeScale
    const width = isResizing ? currentWidth : (clip.timelineEndMs - clip.timelineStartMs) * timeScale
    const durationMs = clip.timelineEndMs - clip.timelineStartMs

    const isCaption = clip.type === 'caption'
    const isSelected = selectedClipIds.includes(clip.id)
    const isInMultiSelection = selectedClipIds.includes(clip.id)
    const isMultiSelectionActive = selectedClipIds.length > 1
    const isPrimarySelection = isSelected && !isMultiSelectionActive

    // Calculate snapped position and check for collisions
    const calculateSnappedPosition = useCallback((rawLeft: number, clipWidth: number, trackId: string) => {
        // Snap to grid (500ms intervals)
        const gridSize = 500 * timeScale
        const snappedLeft = Math.round(rawLeft / gridSize) * gridSize
        return Math.max(0, snappedLeft)
    }, [timeScale])

    const checkCollisions = useCallback((newLeft: number, clipWidth: number, trackId: string) => {
        const newStartMs = Math.round(newLeft / timeScale)
        const newEndMs = newStartMs + durationMs

        // Get all clips on the same track, excluding the current clip
        const trackClips = clips.filter(c => c.trackId === trackId && c.id !== clip.id)
        
        // Check for collisions with a minimum overlap threshold (30% of the clip width)
        const minOverlapMs = durationMs * 0.3
        
        // Check for collisions
        return trackClips.some(otherClip => {
            // Calculate overlap amount
            const overlapStartMs = Math.max(newStartMs, otherClip.timelineStartMs)
            const overlapEndMs = Math.min(newEndMs, otherClip.timelineEndMs)
            const overlapMs = overlapEndMs - overlapStartMs

            // Only consider it a collision if the overlap is significant
            return overlapMs > minOverlapMs
        })
    }, [clips, clip.id, durationMs, timeScale])

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
        
        // Create a custom drag image with blue border for track switching
        const dragImage = e.currentTarget.cloneNode(true) as HTMLElement
        dragImage.style.opacity = '0.8'
        dragImage.style.transform = 'rotate(2deg)'
        dragImage.style.border = '2px solid #3b82f6'
        document.body.appendChild(dragImage)
        e.dataTransfer.setDragImage(dragImage, e.nativeEvent.offsetX, e.nativeEvent.offsetY)
        setTimeout(() => document.body.removeChild(dragImage), 0)
    }

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setContextMenuPosition({ x: e.clientX, y: e.clientY })
        setShowContextMenu(true)
    }

    // Optimized mouse event handlers for dragging
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.button !== 0) return // Only left mouse button

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
    }, [left, clip.trackId])

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

        // Only update if position actually changed
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
        }
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

            let newStartMs = resizeStartMs + deltaMs
            newStartMs = Math.max(minStartMs, Math.min(newStartMs, maxStartMs))

            // Update visual position and width directly
            setCurrentLeft(newStartMs * timeScale)
            setCurrentWidth((clip.timelineEndMs - newStartMs) * timeScale)
        } else {
            // Calculate new end time with constraints
            const minEndMs = clip.timelineStartMs + 100 // Minimum 100ms duration
            const maxEndMs = clip.timelineStartMs + 30000 // Maximum 30s duration for text clips

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
            newStartMs = Math.max(minStartMs, Math.min(newStartMs, maxStartMs))

            executeCommand({
                type: 'UPDATE_CLIP',
                payload: {
                    before: clip,
                    after: {
                        ...clip,
                        timelineStartMs: newStartMs,
                        sourceStartMs: 0
                    }
                }
            })
        } else {
            const minEndMs = clip.timelineStartMs + 100
            const maxEndMs = clip.timelineStartMs + 30000

            let newEndMs = resizeStartMs + deltaMs
            newEndMs = Math.max(minEndMs, Math.min(newEndMs, maxEndMs))

            executeCommand({
                type: 'UPDATE_CLIP',
                payload: {
                    before: clip,
                    after: {
                        ...clip,
                        timelineEndMs: newEndMs,
                        sourceEndMs: newEndMs - clip.timelineStartMs
                    }
                }
            })
        }

        setIsResizing(false)
        setResizeType(null)
        document.body.classList.remove('cursor-ew-resize')
    }

    // Add resize event listeners
    useEffect(() => {
        if (!isResizing) return

        document.addEventListener('mousemove', handleResizeMove)
        document.addEventListener('mouseup', handleResizeEnd)

        return () => {
            document.removeEventListener('mousemove', handleResizeMove)
            document.removeEventListener('mouseup', handleResizeEnd)
        }
    }, [isResizing, handleResizeMove, handleResizeEnd])

    const textContent = clip.properties?.text || (isCaption ? 'Caption' : 'Text Overlay')
    const truncatedText = textContent.length > 20 ? textContent.substring(0, 20) + '...' : textContent

    return (
        <>
            <div
                ref={clipRef}
                data-timeline-clip
                data-clip-id={clip.id}
                className={`
                    absolute h-full rounded-lg overflow-hidden
                    border-2 transition-all duration-75 select-none
                    ${dragState.isOverlapping ? 'border-blue-500 bg-blue-500/20 shadow-lg' : ''}
                    ${isPrimarySelection ? 'border-blue-400 shadow-md' : 
                      isInMultiSelection ? 'border-purple-400 shadow-sm' : 
                      'border-transparent hover:border-gray-400'}
                    ${isShiftHeld ? 'cursor-move border-blue-300 shadow-lg' : 'cursor-grab active:cursor-grabbing'}
                    ${isCaption 
                        ? 'bg-gradient-to-r from-orange-400 to-orange-500 hover:from-orange-500 hover:to-orange-600' 
                        : 'bg-gradient-to-r from-green-400 to-green-500 hover:from-green-500 hover:to-green-600'}
                `}
                style={{
                    left: `${left}px`,
                    width: `${Math.max(width, 20)}px`,
                    transform: dragState.isDragging ? 'translateY(-1px)' : 'translateY(0)',
                }}
                onClick={onClick}
                onContextMenu={handleContextMenu}
                onMouseDown={handleMouseDown}
                draggable={isShiftHeld}
                onDragStart={handleDragStart}
                title={isShiftHeld ? 'Hold Shift and drag to move between tracks' : 'Drag to move - overlapping clips will be automatically pushed forward'}
            >
                {/* Text content area */}
                <div className="w-full h-full flex items-center justify-center px-2 text-white text-xs font-medium truncate">
                            {truncatedText}
                </div>
                <div className="absolute bottom-0 right-0 px-1 text-[10px] text-white/70 bg-black/30 rounded-tl">
                    {formatTime(durationMs)}
                </div>

                {/* Resize handles */}
                {isSelected && (
                    <>
                        <div
                            className="absolute left-0 top-0 w-2 h-full cursor-ew-resize bg-white/10 hover:bg-white/30 transition-colors"
                            onMouseDown={(e) => handleResizeStart(e, 'start')}
                            title="Drag to resize"
                        >
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-400 rounded-r opacity-75" />
                        </div>
                        <div
                            className="absolute right-0 top-0 w-2 h-full cursor-ew-resize bg-white/10 hover:bg-white/30 transition-colors"
                            onMouseDown={(e) => handleResizeStart(e, 'end')}
                            title="Drag to resize"
                        >
                            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-400 rounded-l opacity-75" />
                        </div>
                    </>
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
                        onClick={() => {
                            // Handle delete - this would need to be implemented
                            setShowContextMenu(false)
                        }}
                    >
                        Delete Text
                    </button>
                </div>
            )}
        </>
    )
} 