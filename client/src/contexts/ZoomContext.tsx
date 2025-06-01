import React, { createContext, useContext, ReactNode, useState } from 'react'

interface ZoomContextType {
    zoomLevel: number
    setZoomLevel: (level: number) => void
}

const ZoomContext = createContext<ZoomContextType | undefined>(undefined)

export function ZoomProvider({ children }: { children: ReactNode }) {
    const [zoomLevel, setZoomLevel] = useState(1) // 1 is the default zoom level

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