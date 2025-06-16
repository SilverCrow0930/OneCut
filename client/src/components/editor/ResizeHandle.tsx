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
                e.preventDefault()
                const deltaX = e.clientX - startXRef.current
                onResize(deltaX)
                startXRef.current = e.clientX
            }
        }

        const handleMouseUp = () => {
            if (isDraggingRef.current) {
                isDraggingRef.current = false
                document.body.classList.remove('cursor-ew-resize', 'select-none')
                document.body.style.userSelect = ''
            }
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
                w-4 h-full cursor-ew-resize select-none
                flex items-center justify-center
                hover:bg-gray-200/50 transition-colors
                ${className}
            `}
            onMouseDown={(e) => {
                e.preventDefault()
                e.stopPropagation()
                isDraggingRef.current = true
                startXRef.current = e.clientX
                document.body.classList.add('cursor-ew-resize', 'select-none')
                document.body.style.userSelect = 'none'
            }}
        >
            <div className="w-0.5 h-8 bg-gray-400 rounded-full opacity-60 hover:opacity-100 transition-opacity" />
        </div>
    )
}

export default ResizeHandle 