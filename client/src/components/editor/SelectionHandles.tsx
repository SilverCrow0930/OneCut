import React, { useEffect, useState, useCallback } from 'react'
import { useEditor } from '@/contexts/EditorContext'

interface SelectionHandleData {
    clipId: string
    playerBounds: DOMRect
    clipBounds: {
        left: number
        top: number
        width: number
        height: number
    }
    onResizeStart: (e: React.MouseEvent, type: 'nw' | 'ne' | 'sw' | 'se') => void
    isPrimarySelection: boolean
}

interface SelectionHandlesProps {
    containerRef: React.RefObject<HTMLDivElement | null>
}

const SelectionHandles: React.FC<SelectionHandlesProps> = ({ containerRef }) => {
    const { selectedClipId } = useEditor()
    const [handleData, setHandleData] = useState<SelectionHandleData | null>(null)

    // Listen for handle data updates from ClipLayer
    useEffect(() => {
        const handleUpdateData = (event: CustomEvent<SelectionHandleData>) => {
            if (event.detail.clipId === selectedClipId) {
                setHandleData(event.detail)
            }
        }

        const handleClearData = () => {
            setHandleData(null)
        }

        // Listen for custom events from ClipLayer
        window.addEventListener('updateSelectionHandles', handleUpdateData as EventListener)
        window.addEventListener('clearSelectionHandles', handleClearData)

        return () => {
            window.removeEventListener('updateSelectionHandles', handleUpdateData as EventListener)
            window.removeEventListener('clearSelectionHandles', handleClearData)
        }
    }, [selectedClipId])

    // Clear handle data when selection changes
    useEffect(() => {
        if (!selectedClipId) {
            setHandleData(null)
        }
    }, [selectedClipId])

    if (!handleData || !containerRef.current) {
        return null
    }

    const containerRect = containerRef.current.getBoundingClientRect()
    const playerRect = handleData.playerBounds

    // Calculate player position relative to container
    const playerRelativeLeft = playerRect.left - containerRect.left
    const playerRelativeTop = playerRect.top - containerRect.top

    // Calculate handle positions in container coordinates
    const handleLeft = playerRelativeLeft + handleData.clipBounds.left
    const handleTop = playerRelativeTop + handleData.clipBounds.top
    const handleWidth = handleData.clipBounds.width
    const handleHeight = handleData.clipBounds.height

    const handleStyle = {
        position: 'absolute' as const,
        left: handleLeft,
        top: handleTop,
        width: handleWidth,
        height: handleHeight,
        pointerEvents: 'none' as const,
        zIndex: 1000
    }

    return (
        <div style={handleStyle}>
            {/* Selection border */}
            <div 
                className="absolute inset-[-2px] border-2 border-purple-400 rounded shadow-[0_0_0_1px_rgba(216,180,254,0.3)]"
                style={{ pointerEvents: 'none' }}
            />
            
            {/* Corner Resize handles - only show for primary selection */}
            {handleData.isPrimarySelection && (
                <>
                    {/* NW */}
                    <div
                        className="absolute cursor-nwse-resize hover:scale-110 transition-all duration-150"
                        style={{
                            left: 0,
                            top: 0,
                            transform: 'translate(-50%, -50%)',
                            width: '12px',
                            height: '12px',
                            background: 'white',
                            border: '2px solid rgba(216, 180, 254, 0.9)',
                            borderRadius: '50%',
                            boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.1)',
                            willChange: 'transform',
                            pointerEvents: 'auto'
                        }}
                        onMouseDown={(e) => handleData.onResizeStart(e, 'nw')}
                    />
                    {/* NE */}
                    <div
                        className="absolute cursor-nesw-resize hover:scale-110 transition-all duration-150"
                        style={{
                            right: 0,
                            top: 0,
                            transform: 'translate(50%, -50%)',
                            width: '12px',
                            height: '12px',
                            background: 'white',
                            border: '2px solid rgba(216, 180, 254, 0.9)',
                            borderRadius: '50%',
                            boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.1)',
                            willChange: 'transform',
                            pointerEvents: 'auto'
                        }}
                        onMouseDown={(e) => handleData.onResizeStart(e, 'ne')}
                    />
                    {/* SW */}
                    <div
                        className="absolute cursor-nesw-resize hover:scale-110 transition-all duration-150"
                        style={{
                            left: 0,
                            bottom: 0,
                            transform: 'translate(-50%, 50%)',
                            width: '12px',
                            height: '12px',
                            background: 'white',
                            border: '2px solid rgba(216, 180, 254, 0.9)',
                            borderRadius: '50%',
                            boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.1)',
                            willChange: 'transform',
                            pointerEvents: 'auto'
                        }}
                        onMouseDown={(e) => handleData.onResizeStart(e, 'sw')}
                    />
                    {/* SE */}
                    <div
                        className="absolute cursor-nwse-resize hover:scale-110 transition-all duration-150"
                        style={{
                            right: 0,
                            bottom: 0,
                            transform: 'translate(50%, 50%)',
                            width: '12px',
                            height: '12px',
                            background: 'white',
                            border: '2px solid rgba(216, 180, 254, 0.9)',
                            borderRadius: '50%',
                            boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.1)',
                            willChange: 'transform',
                            pointerEvents: 'auto'
                        }}
                        onMouseDown={(e) => handleData.onResizeStart(e, 'se')}
                    />
                </>
            )}
        </div>
    )
}

export default SelectionHandles 