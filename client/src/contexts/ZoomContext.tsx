import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react'

interface ZoomContextType {
    zoomLevel: number
    setZoomLevel: (level: number) => void
}

const ZoomContext = createContext<ZoomContextType | undefined>(undefined)

export function ZoomProvider({ children }: { children: ReactNode }) {
    // Initialize from localStorage if available, otherwise use default value of 1
    const [zoomLevel, setZoomLevel] = useState(() => {
        if (typeof window !== 'undefined') {
            const savedZoom = localStorage.getItem('lemona-zoom-level')
            return savedZoom ? parseFloat(savedZoom) : 1
        }
        return 1
    })

    // Save to localStorage whenever zoomLevel changes
    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('lemona-zoom-level', zoomLevel.toString())
        }
    }, [zoomLevel])

    return (
        <ZoomContext.Provider value={{ zoomLevel, setZoomLevel }}>
            {children}
        </ZoomContext.Provider>
    )
}

export function useZoom() {
    const context = useContext(ZoomContext)
    if (context === undefined) {
        throw new Error('useZoom must be used within a ZoomProvider')
    }
    return context
} 