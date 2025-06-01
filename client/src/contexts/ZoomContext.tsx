import React, { createContext, useContext, ReactNode, useState } from 'react'

interface ZoomContextType {
    zoomLevel: number
    setZoomLevel: (level: number) => void
}

const ZoomContext = createContext<ZoomContextType | undefined>(undefined)

export function ZoomProvider({ children }: { children: ReactNode }) {
    const [zoomLevel, setZoomLevel] = useState(2.5) // 2.5 zoom level for better default view

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