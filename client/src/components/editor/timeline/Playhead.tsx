import React, { useRef, useEffect } from 'react'

interface PlayheadProps {
    playheadX: number
    onDrag?: (e: React.MouseEvent) => void
    isPlaying: boolean
}

const Playhead = ({ playheadX, onDrag, isPlaying }: PlayheadProps) => {
    const isDraggingRef = useRef(false)

    useEffect(() => {
        const handleMouseUp = () => {
            isDraggingRef.current = false
        }

        const handleMouseMove = (e: MouseEvent) => {
            if (isDraggingRef.current && onDrag) {
                onDrag(e as unknown as React.MouseEvent)
            }
        }

        document.addEventListener('mouseup', handleMouseUp)
        document.addEventListener('mousemove', handleMouseMove)

        return () => {
            document.removeEventListener('mouseup', handleMouseUp)
            document.removeEventListener('mousemove', handleMouseMove)
        }
    }, [onDrag])

    return (
        <div
            className="absolute top-0 bottom-0 cursor-ew-resize"
            style={{
                left: playheadX - 8, // Offset to center the hit area
                width: 16, // 16px wide hit area
                zIndex: 9998
            }}
            onMouseDown={(e) => {
                if (!isPlaying) {
                    isDraggingRef.current = true
                    e.preventDefault()
                }
            }}
        >
            {/* Rectangular handle */}
            <div
                className="absolute top-0 left-1/2 -translate-x-1/2 bg-red-500"
                style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '1px'
                }}
            />
            {/* Vertical line */}
            <div
                className="absolute top-0 bottom-0 w-px bg-red-500"
                style={{
                    left: '50%', // Center the line in the hit area
                    transform: 'translateX(-50%)'
                }}
            />
        </div>
    )
}

export default Playhead