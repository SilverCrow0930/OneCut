import React from 'react'
import { useZoom } from '@/contexts/ZoomContext'

const ZoomSlider = () => {
    const { zoomLevel, setZoomLevel } = useZoom()

    const minZoom = 0.1;
    const maxZoom = 50;

    // Convert zoomLevel to slider position (0 to 1)
    const zoomToSlider = (zoom: number) => {
        if (zoom === 1) return 0.5; // Center at 100%
        if (zoom < 1) {
            // Map 0.1 to 1 to 0 to 0.5
            return (Math.log10(zoom) - Math.log10(minZoom)) / (Math.log10(1) - Math.log10(minZoom)) * 0.5;
        } else {
            // Map 1 to 50 to 0.5 to 1
            return 0.5 + (Math.log10(zoom) - Math.log10(1)) / (Math.log10(maxZoom) - Math.log10(1)) * 0.5;
        }
    };
    // Convert slider position (0 to 1) to zoomLevel
    const sliderToZoom = (sliderValue: number) => {
        if (sliderValue === 0.5) return 1; // Center at 100%
        if (sliderValue < 0.5) {
            // Map 0 to 0.5 to 0.1 to 1
            return minZoom * Math.pow((1 / minZoom), sliderValue * 2);
        } else {
            // Map 0.5 to 1 to 1 to 50
            return Math.pow(maxZoom, (sliderValue - 0.5) * 2);
        }
    };

    const sliderValue = zoomToSlider(zoomLevel);

    const handleZoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const sliderVal = parseFloat(e.target.value);
        let value = sliderToZoom(sliderVal);
        // Snap to nearest 0.1 below 1, nearest 1 above 1
        if (value < 1) {
            value = Math.round(value * 10) / 10;
        } else {
            value = Math.round(value);
        }
        setZoomLevel(value);
    }

    // Calculate the percentage for the gradient (sliderValue is 0 to 1)
    const percentage = sliderValue * 100;

    return (
        <div className="
            flex items-center gap-4 px-4 py-3 h-full
            rounded-xl text-black
        ">
            <div className="relative w-32 h-4 flex items-center">
                <div
                    className="absolute w-full h-2.5 rounded-full shadow-inner"
                    style={{
                        background: `linear-gradient(to right, #3B82F6 ${percentage}%, #E5E7EB ${percentage}%)`
                    }}
                ></div>
                <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.001}
                    value={sliderValue}
                    onChange={handleZoomChange}
                    className="w-full h-2.5 bg-transparent appearance-none cursor-pointer relative z-10
                        [&::-webkit-slider-thumb]:appearance-none 
                        [&::-webkit-slider-thumb]:w-5 
                        [&::-webkit-slider-thumb]:h-5 
                        [&::-webkit-slider-thumb]:rounded-full 
                        [&::-webkit-slider-thumb]:bg-white
                        [&::-webkit-slider-thumb]:shadow-lg 
                        [&::-webkit-slider-thumb]:border-2
                        [&::-webkit-slider-thumb]:border-blue-500
                        [&::-webkit-slider-thumb]:cursor-pointer 
                        [&::-webkit-slider-thumb]:transition-all
                        [&::-webkit-slider-thumb]:duration-200
                        [&::-webkit-slider-thumb]:hover:scale-110
                        [&::-moz-range-thumb]:w-5 
                        [&::-moz-range-thumb]:h-5 
                        [&::-moz-range-thumb]:rounded-full 
                        [&::-moz-range-thumb]:bg-white 
                        [&::-moz-range-thumb]:border-2 
                        [&::-moz-range-thumb]:border-blue-500 
                        [&::-moz-range-thumb]:shadow-lg 
                        [&::-moz-range-thumb]:cursor-pointer"
                />
            </div>
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 backdrop-blur-sm px-3 py-1.5 rounded-lg shadow-sm border border-blue-200/40">
                <span className="text-sm font-semibold tabular-nums whitespace-nowrap text-blue-700">
                    {Math.round(zoomLevel * 100)}%
                </span>
            </div>
        </div>
    )
}

export default ZoomSlider