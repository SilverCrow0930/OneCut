import React, { useState, useRef } from 'react'
import { Clip } from '@/types/editor'
import { getTimeScale } from '@/lib/constants'
import { useZoom } from '@/contexts/ZoomContext'
import { useEditor } from '@/contexts/EditorContext'
import { formatTime } from '@/lib/utils'

export default function TextClipItem({ clip }: { clip: Clip }) {
    const { zoomLevel } = useZoom()
    const { selectedClipIds, setSelectedClipIds, setSelectedClipId, executeCommand } = useEditor()
    const timeScale = getTimeScale(zoomLevel)
    const [showContextMenu, setShowContextMenu] = useState(false)
    const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 })
    const [isShiftHeld, setIsShiftHeld] = useState(false)
    const [isDragging, setIsDragging] = useState(false)
    const [dragStartX, setDragStartX] = useState(0)
    const [dragStartLeft, setDragStartLeft] = useState(0)
    const clipRef = useRef<HTMLDivElement>(null)

    // convert ms → px
    const left = isDragging ? dragStartLeft : clip.timelineStartMs * timeScale
    const width = (clip.timelineEndMs - clip.timelineStartMs) * timeScale
    const durationMs = clip.timelineEndMs - clip.timelineStartMs

    const isCaption = clip.type === 'caption'
    const isSelected = selectedClipIds.includes(clip.id)
    const isInMultiSelection = selectedClipIds.includes(clip.id)
    const isMultiSelectionActive = selectedClipIds.length > 1
    const isPrimarySelection = isSelected && !isMultiSelectionActive

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

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return // Only left mouse button
        
        // If Shift is held, we'll use HTML5 drag for track switching
        if (e.shiftKey) return

        e.preventDefault()
        e.stopPropagation()

        setIsDragging(true)
        setDragStartX(e.clientX)
        setDragStartLeft(e.clientX - (clipRef.current?.getBoundingClientRect().left || 0))

        // Add visual feedback
        document.body.style.cursor = 'grabbing'
        if (clipRef.current) {
            clipRef.current.style.zIndex = '1000'
            clipRef.current.style.opacity = '0.9'
        }

        // Add document-level event listeners
        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)
    }

    const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging) return

        const deltaX = e.clientX - dragStartX
        const newLeft = dragStartLeft + deltaX
        
        // Update clip position
        if (clipRef.current) {
            clipRef.current.style.left = `${Math.max(0, newLeft)}px`
        }
    }

    const handleMouseUp = (e: MouseEvent) => {
        if (!isDragging) return

        // Remove document-level event listeners
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)

        // Remove visual feedback
        document.body.style.cursor = ''
        if (clipRef.current) {
            clipRef.current.style.zIndex = ''
            clipRef.current.style.opacity = ''
        }

        // Calculate new position in milliseconds
        const deltaX = e.clientX - dragStartX
        const deltaMs = Math.round(deltaX / timeScale)
        const newStartMs = Math.max(0, clip.timelineStartMs + deltaMs)
        const duration = clip.timelineEndMs - clip.timelineStartMs

        // Update clip position through command
        executeCommand({
            type: 'UPDATE_CLIP',
            payload: {
                before: clip,
                after: {
                    ...clip,
                    timelineStartMs: newStartMs,
                    timelineEndMs: newStartMs + duration
                }
            }
        })

        setIsDragging(false)
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

    const textContent = clip.properties?.text || (isCaption ? 'Caption' : 'Text Overlay')
    const truncatedText = textContent.length > 20 ? textContent.substring(0, 20) + '...' : textContent

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
                    ${isDragging ? 'border-blue-500 bg-blue-500/20 shadow-lg' : ''}
                    ${isPrimarySelection ? 'border-blue-400 shadow-md' : 
                      isInMultiSelection ? 'border-purple-400 shadow-sm' : 
                      'border-transparent hover:border-gray-400'}
                    ${isShiftHeld ? 'cursor-move border-blue-300 shadow-lg' : 'cursor-grab active:cursor-grabbing'}
                    select-none overflow-hidden bg-purple-500 hover:bg-purple-600
                `}
                style={{
                    left: `${left}px`,
                    width: `${Math.max(width, 20)}px`,
                    transform: isDragging ? 'translateY(-1px)' : 'translateY(0)',
                }}
                onClick={onClick}
                onContextMenu={handleContextMenu}
                onMouseDown={handleMouseDown}
                draggable={isShiftHeld}
                onDragStart={handleDragStart}
                title={isShiftHeld ? 'Hold Shift and drag to move between tracks' : 'Drag to move'}
            >
                {/* Content container */}
                <div className="flex items-center justify-between w-full px-2 py-1">
                    {/* Icon and text */}
                    <div className="flex items-center space-x-1.5 min-w-0">
                        {/* Icon */}
                        {isCaption ? (
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" />
                            </svg>
                        ) : (
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
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