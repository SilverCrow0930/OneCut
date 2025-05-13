import React from 'react'
import { useZoom } from '@/contexts/ZoomContext'

const ZoomSlider = () => {
    const { zoomLevel, setZoomLevel } = useZoom()

    const handleZoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setZoomLevel(parseFloat(e.target.value))
    }

    return (
        <div className="
            flex items-center gap-1 px-1.5 py-1 h-full
            bg-gray-800/80 backdrop-blur-sm rounded-lg text-gray-100
        ">
            <input
                type="range"
                min="0.1"
                max="2"
                step="0.1"
                value={zoomLevel}
                onChange={handleZoomChange}
                className="w-16 h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-0"
            />
            <span className="text-xs font-medium tabular-nums whitespace-nowrap min-w-[2rem] text-right">
                {Math.round(zoomLevel * 100)}%
            </span>
        </div>
    )
}

export default ZoomSlider