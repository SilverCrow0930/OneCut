import React, { useRef, useEffect } from 'react'

interface ResizeHandleProps {
    onResize: (deltaX: number) => void
    className?: string
}

const ResizeHandle: React.FC<ResizeHandleProps> = ({ onResize, className = '' }) => {
    const isDraggingRef = useRef(false)
    const startXRef = useRef(0)

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isDraggingRef.current) {
                const deltaX = e.clientX - startXRef.current
                onResize(deltaX)
                startXRef.current = e.clientX
            }
        }

        const handleMouseUp = () => {
            isDraggingRef.current = false
            document.body.classList.remove('cursor-ew-resize')
        }

        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)

        return () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
        }
    }, [onResize])

    return (
        <div
            className={`
                w-4 h-full cursor-ew-resize
                flex items-center justify-center
                hover:bg-blue-100/50 transition-colors duration-150
                group
                ${className}
            `}
            onMouseDown={(e) => {
                isDraggingRef.current = true
                startXRef.current = e.clientX
                document.body.classList.add('cursor-ew-resize')
            }}
        >
            {/* Grip dots indicator */}
            <div className="flex flex-col gap-1 opacity-40 group-hover:opacity-70 transition-opacity duration-150">
                <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
            </div>
        </div>
    )
}

export default ResizeHandle 