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
    try {
        const { clips, tracks, selectedClipIds, setSelectedClipIds, setSelectedClipId } = useEditor()
        
        // Ensure we have the required props before proceeding
        if (!setSelectedClipIds || !setSelectedClipId) {
            return <div className="relative w-full h-full">{children}</div>
        }
        
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
            
            // Check for intersection using overlap logic
            const horizontalOverlap = Math.max(0, Math.min(relativeElementRect.right, selectionBox.left + selectionBox.width) - Math.max(relativeElementRect.left, selectionBox.left))
            const verticalOverlap = Math.max(0, Math.min(relativeElementRect.bottom, selectionBox.top + selectionBox.height) - Math.max(relativeElementRect.top, selectionBox.top))
            
            const intersects = horizontalOverlap > 0 && verticalOverlap > 0
            
            console.log('🔍 Intersection check:', {
                clipId: element.getAttribute('data-clip-id'),
                elementRect: relativeElementRect,
                selectionBox,
                horizontalOverlap,
                verticalOverlap,
                intersects
            })
            
            return intersects
        }, [])

        // Find clips that intersect with the current selection
        const getSelectedClips = useCallback((): string[] => {
            const selectionBox = getSelectionBox()
            if (!selectionBox || !containerRef.current) return []
            
            const selectedIds: string[] = []
            
            // Find all clip elements in both player and timeline
            const clipElements = containerRef.current.querySelectorAll('[data-clip-layer], [data-timeline-clip]')
            
            console.log('🔍 Marquee selection debug:', {
                selectionBox,
                foundElements: clipElements.length,
                elementTypes: Array.from(clipElements).map(el => ({
                    id: el.getAttribute('data-clip-id'),
                    hasDataClipLayer: el.hasAttribute('data-clip-layer'),
                    hasDataTimelineClip: el.hasAttribute('data-timeline-clip'),
                    tagName: el.tagName,
                    rect: el.getBoundingClientRect()
                }))
            })
            
            clipElements.forEach((element) => {
                const clipId = element.getAttribute('data-clip-id')
                if (clipId && isElementInSelection(element as HTMLElement, selectionBox)) {
                    selectedIds.push(clipId)
                    console.log('✅ Selected clip:', clipId)
                } else if (clipId) {
                    console.log('❌ Clip not in selection:', clipId, {
                        elementRect: element.getBoundingClientRect(),
                        selectionBox
                    })
                }
            })
            
            console.log('🎯 Final selected IDs:', selectedIds)
            return [...new Set(selectedIds)] // Remove duplicates
        }, [getSelectionBox, isElementInSelection])

        const handleMouseDown = useCallback((e: React.MouseEvent) => {
            if (disabled) return
            
            // Don't start selection if clicking on a clip or UI element
            const target = e.target as HTMLElement
            const clickedElement = target.closest('[data-clip-layer], [data-timeline-clip], button, input, textarea, select, [role="button"]')
            
            console.log('🖱️ Mouse down debug:', {
                target: target.tagName,
                clickedElement: clickedElement?.tagName,
                willStartSelection: !clickedElement
            })
            
            if (clickedElement) {
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
            
            console.log('🚀 Starting marquee selection at:', { startX, startY })
            
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
            console.log('📝 Updating selection in real-time:', selectedIds)
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
                {isSelecting && selectionBox && (
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
                
                {/* Debug info */}
                {isSelecting && selectionBox && (
                    <div 
                        className="absolute pointer-events-none z-50 bg-black text-white text-xs p-2 rounded"
                        style={{ 
                            left: selectionBox.left + selectionBox.width + 5, 
                            top: selectionBox.top 
                        }}
                    >
                        {selectionBox.width.toFixed(0)}x{selectionBox.height.toFixed(0)}
                    </div>
                )}
            </div>
        )
    } catch (error) {
        console.error('Error in MarqueeSelection component:', error)
        return <div className="relative w-full h-full">{children}</div>
    }
}

export default MarqueeSelection 