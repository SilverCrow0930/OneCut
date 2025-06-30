import React, { useEffect } from 'react'
import { useZoom } from '@/contexts/ZoomContext'

const ZoomSlider = () => {
    const { zoomLevel, setZoomLevel } = useZoom()

    // More reasonable zoom range
    const minZoom = 0.1;  // 10%
    const maxZoom = 50;   // 5000% (reverted back)

    // Detect and normalize browser zoom to prevent conflicts
    useEffect(() => {
        const handleBrowserZoom = () => {
            // Get browser zoom level
            const browserZoom = window.devicePixelRatio;
            
            // If browser zoom is significantly different from 1, add a warning class
            // This helps identify when browser zoom might interfere with app zoom
            if (Math.abs(browserZoom - 1) > 0.1) {
                document.body.classList.add('browser-zoom-detected');
            } else {
                document.body.classList.remove('browser-zoom-detected');
            }
        };

        // Check on mount and when window resizes
        handleBrowserZoom();
        window.addEventListener('resize', handleBrowserZoom);
        
        return () => {
            window.removeEventListener('resize', handleBrowserZoom);
            document.body.classList.remove('browser-zoom-detected');
        };
    }, []);

    // Simplified linear scaling for better user experience
    const zoomToSlider = (zoom: number) => {
        // Map zoom range [0.1, 10] to slider range [0, 1]
        // Use logarithmic scaling but with reasonable bounds
        const logMin = Math.log10(minZoom);
        const logMax = Math.log10(maxZoom);
        const logZoom = Math.log10(zoom);
        return (logZoom - logMin) / (logMax - logMin);
    };

    const sliderToZoom = (sliderValue: number) => {
        // Map slider range [0, 1] to zoom range [0.1, 10]
        const logMin = Math.log10(minZoom);
        const logMax = Math.log10(maxZoom);
        const logZoom = logMin + sliderValue * (logMax - logMin);
        return Math.pow(10, logZoom);
    };

    const sliderValue = zoomToSlider(zoomLevel);

    const handleZoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const sliderVal = parseFloat(e.target.value);
        let value = sliderToZoom(sliderVal);
        
        // Better snapping logic
        if (value < 1) {
            // Snap to common zoom levels below 100%
            const snapValues = [0.1, 0.25, 0.5, 0.75];
            const closest = snapValues.reduce((prev, curr) => 
                Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
            );
            if (Math.abs(closest - value) < 0.05) {
                value = closest;
            } else {
                value = Math.round(value * 20) / 20; // Snap to 0.05 increments
            }
        } else {
            // Snap to whole numbers above 100%
            const snapValues = [1, 1.5, 2, 3, 4, 5, 6, 8, 10];
            const closest = snapValues.reduce((prev, curr) => 
                Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
            );
            if (Math.abs(closest - value) < 0.1) {
                value = closest;
            } else {
                value = Math.round(value * 2) / 2; // Snap to 0.5 increments
            }
        }
        
        // Ensure value stays within bounds
        value = Math.max(minZoom, Math.min(maxZoom, value));
        setZoomLevel(value);
    }

    // Calculate the percentage for the gradient (sliderValue is 0 to 1)
    const percentage = sliderValue * 100;

    return (
        <div className="
            flex items-center gap-3 px-3 py-2 h-full
            backdrop-blur-sm rounded-lg text-black
        ">
            <div className="relative w-28 h-4 flex items-center">
                <div
                    className="absolute w-full h-2 rounded-full"
                    style={{
                        background: `linear-gradient(to right, #4B5563 ${percentage}%, #9CA3AF ${percentage}%)`
                    }}
                ></div>
                <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.001}
                    value={sliderValue}
                    onChange={handleZoomChange}
                    className="w-full h-2 bg-transparent appearance-none cursor-pointer relative z-10
                        [&::-webkit-slider-thumb]:appearance-none 
                        [&::-webkit-slider-thumb]:w-4 
                        [&::-webkit-slider-thumb]:h-4 
                        [&::-webkit-slider-thumb]:rounded-full 
                        [&::-webkit-slider-thumb]:bg-white
                        [&::-webkit-slider-thumb]:border 
                        [&::-webkit-slider-thumb]:border-gray-300
                        [&::-webkit-slider-thumb]:shadow-2xl 
                        [&::-webkit-slider-thumb]:cursor-pointer 
                        [&::-moz-range-thumb]:w-4 
                        [&::-moz-range-thumb]:h-4 
                        [&::-moz-range-thumb]:rounded-full 
                        [&::-moz-range-thumb]:bg-white 
                        [&::-moz-range-thumb]:border 
                        [&::-moz-range-thumb]:border-gray-300 
                        [&::-moz-range-thumb]:shadow-2xl 
                        [&::-moz-range-thumb]:cursor-pointer"
                />
            </div>
            <span className="text-sm font-medium tabular-nums whitespace-nowrap text-gray-700">
                {Math.round(zoomLevel * 100)}%
            </span>
        </div>
    )
}

export default ZoomSlider