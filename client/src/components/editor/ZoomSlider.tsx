import React, { useEffect } from 'react'
import { useZoom } from '@/contexts/ZoomContext'

const ZOOM_STORAGE_KEY = 'lemona-editor-zoom-level';

const ZoomSlider = () => {
    const { zoomLevel, setZoomLevel } = useZoom()
    
    // Load saved zoom level on component mount
    useEffect(() => {
        try {
            const savedZoom = localStorage.getItem(ZOOM_STORAGE_KEY);
            if (savedZoom) {
                setZoomLevel(parseFloat(savedZoom));
            }
        } catch (err) {
            console.warn('Failed to load saved zoom level:', err);
        }
    }, [setZoomLevel]);
    
    // Handle browser zoom changes
    useEffect(() => {
        const handleBrowserZoom = () => {
            // Adjust calculations if needed based on browser zoom
            // This is a placeholder for potential browser zoom handling
        }
        
        window.addEventListener('resize', handleBrowserZoom)
        return () => {
            window.removeEventListener('resize', handleBrowserZoom)
        }
    }, [])
    
    // Convert zoom level (0.1 to 2.0) to slider value (0 to 100)
    const zoomToSlider = (zoom: number) => {
        // Non-linear mapping for better control at lower zoom levels
        if (zoom <= 1) {
            // 0.1 -> 0, 1.0 -> 50
            return (zoom - 0.1) * 50 / 0.9
        } else {
            // 1.0 -> 50, 2.0 -> 100
            return 50 + (zoom - 1) * 50
        }
    }
    
    // Convert slider value (0 to 100) to zoom level (0.1 to 2.0)
    const sliderToZoom = (sliderValue: number) => {
        // Inverse of the non-linear mapping
        if (sliderValue <= 50) {
            // 0 -> 0.1, 50 -> 1.0
            return 0.1 + sliderValue * 0.9 / 50
        } else {
            // 50 -> 1.0, 100 -> 2.0
            return 1 + (sliderValue - 50) / 50
        }
    }
    
    // Handle slider change
    const handleZoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseInt(e.target.value)
        const newZoom = sliderToZoom(value)
        setZoomLevel(newZoom)
        
        // Save zoom level to localStorage
        try {
            localStorage.setItem(ZOOM_STORAGE_KEY, newZoom.toString());
        } catch (err) {
            console.warn('Failed to save zoom level:', err);
        }
    }
    
    const sliderValue = zoomToSlider(zoomLevel)
    const zoomPercentage = Math.round(zoomLevel * 100)
    
    return (
        <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-lg border border-gray-200/60 p-2">
            <span className="text-xs font-medium text-gray-600 min-w-[40px]">
                {zoomPercentage}%
            </span>
            <input
                type="range"
                min="0"
                max="100"
                value={sliderValue}
                onChange={handleZoomChange}
                className="w-32 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
        </div>
    )
}

export default ZoomSlider