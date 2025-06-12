import { useCallback, useRef, useState } from 'react'

interface DragOptions {
    onDragStart?: (e: MouseEvent) => void
    onDragMove?: (e: MouseEvent, deltaX: number, deltaY: number) => void
    onDragEnd?: (e: MouseEvent, deltaX: number, deltaY: number) => void
    throttleMs?: number
    threshold?: number
}

interface DragState {
    isDragging: boolean
    startX: number
    startY: number
    currentX: number
    currentY: number
    deltaX: number
    deltaY: number
}

export function useOptimizedDrag(options: DragOptions = {}) {
    const {
        onDragStart,
        onDragMove,
        onDragEnd,
        throttleMs = 16, // ~60fps
        threshold = 3
    } = options

    const [dragState, setDragState] = useState<DragState>({
        isDragging: false,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0,
        deltaX: 0,
        deltaY: 0
    })

    const lastUpdateTime = useRef<number>(0)

    const handleMouseDown = useCallback((e: MouseEvent) => {
        e.preventDefault()
        
        const newState = {
            isDragging: true,
            startX: e.clientX,
            startY: e.clientY,
            currentX: e.clientX,
            currentY: e.clientY,
            deltaX: 0,
            deltaY: 0
        }
        
        setDragState(newState)
        onDragStart?.(e)
    }, [onDragStart])

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!dragState.isDragging) return

        const now = performance.now()
        if (now - lastUpdateTime.current < throttleMs) return
        lastUpdateTime.current = now

        const deltaX = e.clientX - dragState.startX
        const deltaY = e.clientY - dragState.startY

        // Only start dragging if we've moved beyond the threshold
        if (Math.abs(deltaX) < threshold && Math.abs(deltaY) < threshold) return

        const newState = {
            ...dragState,
            currentX: e.clientX,
            currentY: e.clientY,
            deltaX,
            deltaY
        }

        setDragState(newState)
        onDragMove?.(e, deltaX, deltaY)
    }, [dragState, onDragMove, throttleMs, threshold])

    const handleMouseUp = useCallback((e: MouseEvent) => {
        if (!dragState.isDragging) return

        const deltaX = e.clientX - dragState.startX
        const deltaY = e.clientY - dragState.startY

        setDragState({
            isDragging: false,
            startX: 0,
            startY: 0,
            currentX: 0,
            currentY: 0,
            deltaX: 0,
            deltaY: 0
        })

        onDragEnd?.(e, deltaX, deltaY)
    }, [dragState, onDragEnd])

    return {
        dragState,
        handleMouseDown,
        handleMouseMove,
        handleMouseUp,
        isDragging: dragState.isDragging
    }
} 