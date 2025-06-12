import React, { useState } from 'react'
import { Clip } from '@/types/editor'
import { getTimeScale } from '@/lib/constants'
import { useZoom } from '@/contexts/ZoomContext'
import { useEditor } from '@/contexts/EditorContext'
import { formatTime } from '@/lib/utils'

export default function TextClipItem({ clip }: { clip: Clip }) {
    const { zoomLevel } = useZoom()
    const { selectedClipIds, setSelectedClipIds, setSelectedClipId } = useEditor()
    const timeScale = getTimeScale(zoomLevel)
    const [showContextMenu, setShowContextMenu] = useState(false)
    const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 })

    // convert ms → px
    const left = clip.timelineStartMs * timeScale
    const width = (clip.timelineEndMs - clip.timelineStartMs) * timeScale
    const durationMs = clip.timelineEndMs - clip.timelineStartMs

    const isCaption = clip.type === 'caption'
    const isSelected = selectedClipIds.includes(clip.id)
    const isInMultiSelection = selectedClipIds.includes(clip.id)
    const isMultiSelectionActive = selectedClipIds.length > 1
    const isPrimarySelection = isSelected && !isMultiSelectionActive

    // HTML5 Drag and Drop handlers for moving between tracks
    const handleDragStart = (e: React.DragEvent) => {
        e.dataTransfer.setData('application/json', JSON.stringify({
            clipId: clip.id
        }))
        e.dataTransfer.effectAllowed = 'move'
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

    const textContent = clip.properties?.text || (isCaption ? 'Caption' : 'Text Overlay')
    const truncatedText = textContent.length > 20 ? textContent.substring(0, 20) + '...' : textContent

    return (
        <>
            <div
                data-timeline-clip
                data-clip-id={clip.id}
                className={`
                    absolute h-full rounded-lg overflow-hidden cursor-grab active:cursor-grabbing
                    border-2 transition-all duration-75 select-none
                    ${isPrimarySelection ? 'border-blue-400 shadow-md' : 
                      isInMultiSelection ? 'border-purple-400 shadow-sm' : 
                      'border-transparent hover:border-gray-400'}
                    ${isCaption 
                        ? 'bg-gradient-to-r from-orange-400 to-orange-500 hover:from-orange-500 hover:to-orange-600' 
                        : 'bg-gradient-to-r from-blue-400 to-blue-500 hover:from-blue-500 hover:to-blue-600'}
                `}
                style={{
                    left: `${left}px`,
                    width: `${Math.max(width, 20)}px`,
                }}
                onClick={onClick}
                onContextMenu={handleContextMenu}
                draggable={true}
                onDragStart={handleDragStart}
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