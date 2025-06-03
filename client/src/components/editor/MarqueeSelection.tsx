import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useEditor } from '@/contexts/EditorContext'

interface MarqueeSelectionProps {
    children: React.ReactNode
    disabled?: boolean
}

interface SelectionRect {
    startX: number
    startY: number
    endX: number
    endY: number
}

interface SelectionBox {
    left: number
    top: number
    width: number
    height: number
}

const MarqueeSelection: React.FC<MarqueeSelectionProps> = ({ children, disabled = false }) => {
    const { clips, tracks, selectedClipIds, setSelectedClipIds, setSelectedClipId } = useEditor()
    const [isSelecting, setIsSelecting] = useState(false)
    const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const startPosRef = useRef<{ x: number; y: number } | null>(null)

    // Calculate the selection box from the selection rectangle
    const getSelectionBox = useCallback((): SelectionBox | null => {
        if (!selectionRect) return null
        
        return {
            left: Math.min(selectionRect.startX, selectionRect.endX),
            top: Math.min(selectionRect.startY, selectionRect.endY),
            width: Math.abs(selectionRect.endX - selectionRect.startX),
            height: Math.abs(selectionRect.endY - selectionRect.startY)
        }
    }, [selectionRect])

    // Check if a DOM element intersects with the selection box
    const isElementInSelection = useCallback((element: HTMLElement, selectionBox: SelectionBox): boolean => {
        if (!containerRef.current) return false
        
        const containerRect = containerRef.current.getBoundingClientRect()
        const elementRect = element.getBoundingClientRect()
        
        // Convert element coordinates to container-relative coordinates
        const relativeElementRect = {
            left: elementRect.left - containerRect.left,
            top: elementRect.top - containerRect.top,
            right: elementRect.right - containerRect.left,
            bottom: elementRect.bottom - containerRect.top
        }
        
        // Check for intersection
        const intersects = !(
            relativeElementRect.right < selectionBox.left ||
            relativeElementRect.left > selectionBox.left + selectionBox.width ||
            relativeElementRect.bottom < selectionBox.top ||
            relativeElementRect.top > selectionBox.top + selectionBox.height
        )
        
        return intersects
    }, [])

    // Find clips that intersect with the current selection
    const getSelectedClips = useCallback((): string[] => {
        const selectionBox = getSelectionBox()
        if (!selectionBox || !containerRef.current) return []
        
        const selectedIds: string[] = []
        
        // Find all clip elements in both player and timeline
        const clipElements = containerRef.current.querySelectorAll('[data-clip-layer], [data-timeline-clip]')
        
        clipElements.forEach((element) => {
            const clipId = element.getAttribute('data-clip-id')
            if (clipId && isElementInSelection(element as HTMLElement, selectionBox)) {
                selectedIds.push(clipId)
            }
        })
        
        return [...new Set(selectedIds)] // Remove duplicates
    }, [getSelectionBox, isElementInSelection])

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (disabled) return
        
        // Don't start selection if clicking on a clip or UI element
        const target = e.target as HTMLElement
        if (target.closest('[data-clip-layer], [data-timeline-clip], button, input, textarea, select, [role="button"]')) {
            return
        }
        
        // Only start selection on left mouse button
        if (e.button !== 0) return
        
        e.preventDefault()
        e.stopPropagation()
        
        const rect = containerRef.current?.getBoundingClientRect()
        if (!rect) return
        
        const startX = e.clientX - rect.left
        const startY = e.clientY - rect.top
        
        startPosRef.current = { x: startX, y: startY }
        setIsSelecting(true)
        setSelectionRect({
            startX,
            startY,
            endX: startX,
            endY: startY
        })
        
        // Clear current selection at start
        setSelectedClipIds([])
        setSelectedClipId(null)
    }, [disabled, setSelectedClipIds, setSelectedClipId])

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isSelecting || !startPosRef.current || !containerRef.current) return
        
        const rect = containerRef.current.getBoundingClientRect()
        const currentX = e.clientX - rect.left
        const currentY = e.clientY - rect.top
        
        setSelectionRect({
            startX: startPosRef.current.x,
            startY: startPosRef.current.y,
            endX: currentX,
            endY: currentY
        })
        
        // Update selection in real-time
        const selectedIds = getSelectedClips()
        setSelectedClipIds(selectedIds)
    }, [isSelecting, getSelectedClips, setSelectedClipIds])

    const handleMouseUp = useCallback(() => {
        if (!isSelecting) return
        
        // Finalize selection
        const selectedIds = getSelectedClips()
        setSelectedClipIds(selectedIds)
        
        // If only one clip is selected, also set it as the single selected clip
        if (selectedIds.length === 1) {
            setSelectedClipId(selectedIds[0])
        } else {
            setSelectedClipId(null)
        }
        
        // Clean up
        setIsSelecting(false)
        setSelectionRect(null)
        startPosRef.current = null
    }, [isSelecting, getSelectedClips, setSelectedClipIds, setSelectedClipId])

    // Set up global mouse events
    useEffect(() => {
        if (isSelecting) {
            document.addEventListener('mousemove', handleMouseMove)
            document.addEventListener('mouseup', handleMouseUp)
            
            return () => {
                document.removeEventListener('mousemove', handleMouseMove)
                document.removeEventListener('mouseup', handleMouseUp)
            }
        }
    }, [isSelecting, handleMouseMove, handleMouseUp])

    // Render the selection box
    const selectionBox = getSelectionBox()

    return (
        <div
            ref={containerRef}
            className="relative w-full h-full"
            onMouseDown={handleMouseDown}
            style={{ userSelect: 'none' }}
        >
            {children}
            
            {/* Selection overlay */}
            {isSelecting && selectionBox && selectionBox.width > 2 && selectionBox.height > 2 && (
                <div
                    className="absolute pointer-events-none z-50 border-2 border-blue-500 bg-blue-500/10 rounded-sm"
                    style={{
                        left: selectionBox.left,
                        top: selectionBox.top,
                        width: selectionBox.width,
                        height: selectionBox.height,
                    }}
                />
            )}
        </div>
    )
}

export default MarqueeSelection 