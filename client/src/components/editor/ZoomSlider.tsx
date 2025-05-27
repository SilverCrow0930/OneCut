import React from 'react'
import { useZoom } from '@/contexts/ZoomContext'

const ZoomSlider = () => {
    const { zoomLevel, setZoomLevel } = useZoom()

    const handleZoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setZoomLevel(parseFloat(e.target.value))
    }

    // Calculate the percentage for the gradient
    const percentage = ((zoomLevel - 0.1) / (2 - 0.1)) * 100

    return (
        <div className="
            flex items-center gap-1 px-1.5 py-1 h-full
            backdrop-blur-sm rounded-lg text-black
        ">
            <div className="relative w-24 h-4 flex items-center">
                <div
                    className="absolute w-full h-2 rounded-full"
                    style={{
                        background: `linear-gradient(to right, #4B5563 ${percentage}%, #9CA3AF ${percentage}%)`
                    }}
                ></div>
                <input
                    type="range"
                    min="0.1"
                    max="2"
                    step="0.1"
                    value={zoomLevel}
                    onChange={handleZoomChange}
                    className="w-full h-2 bg-transparent appearance-none cursor-pointer relative z-10
                        [&::-webkit-slider-thumb]:appearance-none 
                        [&::-webkit-slider-thumb]:w-4 
                        [&::-webkit-slider-thumb]:h-4 
                        [&::-webkit-slider-thumb]:rounded-full 
                        [&::-webkit-slider-thumb]:bg-white
                        [&::-webkit-slider-thumb]:shadow-2xl 
                        [&::-webkit-slider-thumb]:cursor-pointer 
                        [&::-moz-range-thumb]:w-4 
                        [&::-moz-range-thumb]:h-4 
                        [&::-moz-range-thumb]:rounded-full 
                        [&::-moz-range-thumb]:bg-white 
                        [&::-moz-range-thumb]:border 
                        [&::-moz-range-thumb]:border-black 
                        [&::-moz-range-thumb]:shadow-2xl 
                        [&::-moz-range-thumb]:cursor-pointer"
                />
            </div>
            <span className="text-xs font-normal tabular-nums whitespace-nowrap min-w-[2rem] text-gray-700 text-right">
                {Math.round(zoomLevel * 100)}%
            </span>
        </div>
    )
}

export default ZoomSlider