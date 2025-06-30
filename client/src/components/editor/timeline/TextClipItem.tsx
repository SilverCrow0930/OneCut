import React, { useState, useRef, useCallback } from 'react'
import { Clip } from '@/types/editor'
import { getTimeScale } from '@/lib/constants'
import { useZoom } from '@/contexts/ZoomContext'
import { useEditor } from '@/contexts/EditorContext'
import { formatTime } from '@/lib/utils'

export default function TextClipItem({ clip }: { clip: Clip }) {
    const { zoomLevel } = useZoom()
    const { selectedClipIds, setSelectedClipIds, setSelectedClipId, executeCommand, clips } = useEditor()
    const timeScale = getTimeScale(zoomLevel)
    const [showContextMenu, setShowContextMenu] = useState(false)
    const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 })
    const [isShiftHeld, setIsShiftHeld] = useState(false)
    const [isDragging, setIsDragging] = useState(false)
    const [dragStartX, setDragStartX] = useState(0)
    const [dragStartLeft, setDragStartLeft] = useState(0)
    const [currentLeft, setCurrentLeft] = useState(0)
    const clipRef = useRef<HTMLDivElement>(null)

    // convert ms → px
    const left = isDragging ? currentLeft : clip.timelineStartMs * timeScale
    const width = (clip.timelineEndMs - clip.timelineStartMs) * timeScale
    const durationMs = clip.timelineEndMs - clip.timelineStartMs

    const isCaption = clip.type === 'caption'
    const isSelected = selectedClipIds.includes(clip.id)
    const isInMultiSelection = selectedClipIds.includes(clip.id)
    const isMultiSelectionActive = selectedClipIds.length > 1
    const isPrimarySelection = isSelected && !isMultiSelectionActive

    // Drag functionality for horizontal movement
    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return // Only left mouse button
        
        e.preventDefault()
        e.stopPropagation()
        
        setIsDragging(true)
        setDragStartX(e.clientX)
        setDragStartLeft(left)
        
        // Add cursor style
        document.body.style.cursor = 'ew-resize'
        document.body.style.userSelect = 'none'
    }

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging) return
        
        const deltaX = e.clientX - dragStartX
        const newLeft = Math.max(0, dragStartLeft + deltaX)
        setCurrentLeft(newLeft)
    }, [isDragging, dragStartX, dragStartLeft])

    const handleMouseUp = useCallback((e: MouseEvent) => {
        if (!isDragging) return
        
        setIsDragging(false)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        
        // Calculate new timeline position
        const newTimelineStartMs = Math.round(currentLeft / timeScale)
        const newTimelineEndMs = newTimelineStartMs + durationMs
        
        // Update the clip
        executeCommand({
            type: 'UPDATE_CLIP',
            payload: {
                before: clip,
                after: {
                    ...clip,
                    timelineStartMs: newTimelineStartMs,
                    timelineEndMs: newTimelineEndMs
                }
            }
        })
    }, [isDragging, currentLeft, timeScale, durationMs, executeCommand, clip])

    // Add/remove mouse event listeners
    React.useEffect(() => {
        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove)
            document.addEventListener('mouseup', handleMouseUp)
        }
        
        return () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
        }
    }, [isDragging, handleMouseMove, handleMouseUp])

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
    React.useEffect(() => {
        const handleClickOutside = () => setShowContextMenu(false)
        document.addEventListener('click', handleClickOutside)
        return () => document.removeEventListener('click', handleClickOutside)
    }, [])

    // Keyboard event listeners for Shift key tracking
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Shift') {
                setIsShiftHeld(true)
                if (!isDragging) {
                    document.body.style.cursor = 'move'
                }
            }
        }

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Shift') {
                setIsShiftHeld(false)
                if (!isDragging) {
                    document.body.style.cursor = ''
                }
            }
        }

        document.addEventListener('keydown', handleKeyDown)
        document.addEventListener('keyup', handleKeyUp)

        return () => {
            document.removeEventListener('keydown', handleKeyDown)
            document.removeEventListener('keyup', handleKeyUp)
            if (!isDragging) {
                document.body.style.cursor = ''
            }
        }
    }, [isDragging])

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
                    ${isPrimarySelection ? 'border-blue-400 shadow-md' : 
                      isInMultiSelection ? 'border-purple-400 shadow-sm' : 
                      'border-transparent hover:border-gray-400'}
                    ${isShiftHeld ? 'cursor-move border-blue-300 shadow-lg' : 'cursor-grab active:cursor-grabbing'}
                    ${isDragging ? 'cursor-ew-resize' : ''}
                    ${isCaption 
                        ? 'bg-gradient-to-r from-orange-400 to-orange-500 hover:from-orange-500 hover:to-orange-600' 
                        : 'bg-gradient-to-r from-blue-400 to-blue-500 hover:from-blue-500 hover:to-blue-600'}
                `}
                style={{
                    left: `${left}px`,
                    width: `${Math.max(width, 20)}px`,
                }}
                onClick={onClick}
                onMouseDown={handleMouseDown}
                onContextMenu={handleContextMenu}
                draggable={isShiftHeld} // Only enable HTML5 drag when Shift is held
                onDragStart={handleDragStart}
                title={isShiftHeld ? 'Hold Shift and drag to move between tracks' : 'Drag to move horizontally, Shift+Drag to move between tracks'}
            >
                {/* Text content area */}
                <div className="flex items-center justify-between h-full px-2 text-white">
                    <div className="flex items-center space-x-2 flex-1 min-w-0">
                        {/* Text type icon */}
                        {isCaption ? (
                            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M7 4V2a1 1 0 011-1h4a1 1 0 011 1v2h3a1 1 0 110 2h-1v9a2 2 0 01-2 2H7a2 2 0 01-2-2V6H4a1 1 0 010-2h3zM9 6v8h2V6H9z" clipRule="evenodd" />
                            </svg>
                        ) : (
                            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zM7 8H5v2h2V8zm2 0h2v2H9V8zm6 0h-2v2h2V8z" clipRule="evenodd" />
                            </svg>
                        )}
                        
                        {/* Text content */}
                        <span className="text-xs font-medium truncate">
                            {truncatedText}
                        </span>
                    </div>
                    
                    {/* Duration indicator */}
                    <div className="text-xs opacity-90 bg-black/30 px-1.5 py-0.5 rounded ml-2 flex-shrink-0">
                        {formatTime(durationMs)}
                    </div>
                </div>

                {/* Type label */}
                <div className="absolute top-1 left-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
                    {isCaption ? 'CAPTION' : 'TEXT'}
                </div>

                {/* Multi-selection indicator */}
                {isInMultiSelection && (
                    <div className="absolute top-1 right-1 w-2 h-2 bg-purple-400 rounded-full" />
                )}

                {/* Text preview on hover for longer text */}
                {textContent.length > 20 && (
                    <div className="absolute bottom-full left-0 mb-1 bg-black/90 text-white text-xs px-2 py-1 rounded opacity-0 hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 max-w-xs">
                        {textContent}
                    </div>
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
                        onClick={() => {
                            executeCommand({
                                type: 'REMOVE_CLIP',
                                payload: { clip }
                            })
                            setShowContextMenu(false)
                        }}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
                    >
                        Delete
                    </button>
                </div>
            )}
        </>
    )
} 