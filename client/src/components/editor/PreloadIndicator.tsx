import React from 'react'

interface PreloadStats {
    totalPreloaded: number
    readyCount: number
    clipsInQueue: number
    memoryUsage: string
    nextClipIn: number | null
}

interface PreloadIndicatorProps {
    stats: PreloadStats
    className?: string
}

export function PreloadIndicator({ stats, className = '' }: PreloadIndicatorProps) {
    const { totalPreloaded, readyCount, clipsInQueue, memoryUsage, nextClipIn } = stats
    
    // Don't show if nothing is being preloaded
    if (totalPreloaded === 0 && clipsInQueue === 0) {
        return null
    }

    const isPreloading = clipsInQueue > 0
    const loadingPercentage = totalPreloaded > 0 ? (readyCount / totalPreloaded) * 100 : 0

    return (
        <div className={`bg-black/75 text-white text-xs px-3 py-2 rounded-lg backdrop-blur-sm ${className}`}>
            <div className="flex items-center gap-2">
                {/* Preload icon */}
                <div className={`w-2 h-2 rounded-full ${isPreloading ? 'bg-yellow-400 animate-pulse' : 'bg-green-400'}`} />
                
                {/* Stats */}
                <div className="flex items-center gap-3">
                    <span className="font-medium">
                        📁 {readyCount}/{totalPreloaded}
                    </span>
                    
                    {nextClipIn !== null && (
                        <span className="text-yellow-300">
                            ⏱️ {nextClipIn}s
                        </span>
                    )}
                    
                    <span className="text-gray-300">
                        {memoryUsage}
                    </span>
                </div>
                
                {/* Loading bar */}
                {totalPreloaded > 0 && (
                    <div className="w-12 h-1 bg-gray-600 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-green-400 transition-all duration-300"
                            style={{ width: `${loadingPercentage}%` }}
                        />
                    </div>
                )}
            </div>
            
            {/* Tooltip info */}
            <div className="text-[10px] text-gray-400 mt-1">
                Preloading {clipsInQueue} clips ahead
            </div>
        </div>
    )
} 