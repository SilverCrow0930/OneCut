// Timeline Performance Configuration
export const TIMELINE_CONFIG = {
    // Drag and Drop Settings
    DRAG: {
        THROTTLE_MS: 16, // ~60fps for smooth dragging
        GRID_SNAP_MS: 100, // Reduced from 500ms for finer control
        SNAP_DISTANCE_PX: 12, // Distance for edge snapping
        MIN_DRAG_DISTANCE: 5, // Minimum pixels to register as drag
        COLLISION_CHECK_RADIUS: 100, // Only check nearby clips for performance
    },
    
    // Visual Feedback
    VISUAL: {
        DRAG_OPACITY: 0.8,
        DRAG_SCALE: 1.02, // Subtle scale effect during drag
        DRAG_SHADOW: 'shadow-lg',
        TRANSITION_DURATION: 75, // ms for smooth transitions
        OVERLAP_COLOR: 'border-red-500 bg-red-500/20',
    },
    
    // Performance Limits
    PERFORMANCE: {
        MAX_THUMBNAILS: 4, // Limit video thumbnails
        MIN_CLIP_WIDTH: 20, // Minimum clip width in pixels
        RENDER_THROTTLE: 16, // Throttle render updates
        MAX_TRACKS_VISIBLE: 4, // Tracks before scrolling
    },
    
    // Timeline Dimensions
    DIMENSIONS: {
        TRACK_HEIGHT: 60, // Height of each track
        RULER_HEIGHT: 30, // Height of time ruler
        PLAYHEAD_WIDTH: 2, // Width of playhead line
        RESIZE_HANDLE_WIDTH: 8, // Width of resize handles
    },
    
    // Zoom and Scale
    ZOOM: {
        MIN_SCALE: 0.1,
        MAX_SCALE: 10,
        DEFAULT_SCALE: 1,
        SCALE_STEP: 0.1,
    }
} as const

// Helper functions for timeline calculations
export const timelineHelpers = {
    /**
     * Convert milliseconds to pixels based on time scale
     */
    msToPixels: (ms: number, timeScale: number): number => {
        return ms * timeScale
    },
    
    /**
     * Convert pixels to milliseconds based on time scale
     */
    pixelsToMs: (pixels: number, timeScale: number): number => {
        return pixels / timeScale
    },
    
    /**
     * Snap time to grid
     */
    snapToGrid: (ms: number, gridMs: number = TIMELINE_CONFIG.DRAG.GRID_SNAP_MS): number => {
        return Math.round(ms / gridMs) * gridMs
    },
    
    /**
     * Check if two clips overlap
     */
    clipsOverlap: (
        clip1Start: number, 
        clip1End: number, 
        clip2Start: number, 
        clip2End: number
    ): boolean => {
        return !(clip1End <= clip2Start || clip1Start >= clip2End)
    },
    
    /**
     * Calculate snap position for clip edges
     */
    calculateSnapPosition: (
        targetPos: number,
        otherClipPositions: Array<{ start: number; end: number }>,
        clipWidth: number,
        snapDistance: number = TIMELINE_CONFIG.DRAG.SNAP_DISTANCE_PX
    ): number => {
        let snappedPos = targetPos
        
        for (const other of otherClipPositions) {
            // Snap to left edge of other clip
            if (Math.abs(targetPos - other.start) < snapDistance) {
                snappedPos = other.start
                break
            }
            // Snap to right edge of other clip
            else if (Math.abs(targetPos - other.end) < snapDistance) {
                snappedPos = other.end
                break
            }
            // Snap our right edge to left edge of other clip
            else if (Math.abs((targetPos + clipWidth) - other.start) < snapDistance) {
                snappedPos = other.start - clipWidth
                break
            }
            // Snap our left edge to right edge of other clip
            else if (Math.abs(targetPos - other.end) < snapDistance) {
                snappedPos = other.end
                break
            }
        }
        
        return Math.max(0, snappedPos)
    },
    
    /**
     * Throttle function calls for performance
     */
    throttle: <T extends (...args: any[]) => any>(
        func: T,
        delay: number
    ): ((...args: Parameters<T>) => void) => {
        let timeoutId: NodeJS.Timeout | null = null
        let lastExecTime = 0
        
        return (...args: Parameters<T>) => {
            const currentTime = Date.now()
            
            if (currentTime - lastExecTime > delay) {
                func(...args)
                lastExecTime = currentTime
            } else {
                if (timeoutId) clearTimeout(timeoutId)
                timeoutId = setTimeout(() => {
                    func(...args)
                    lastExecTime = Date.now()
                }, delay - (currentTime - lastExecTime))
            }
        }
    },
    
    /**
     * Debounce function calls
     */
    debounce: <T extends (...args: any[]) => any>(
        func: T,
        delay: number
    ): ((...args: Parameters<T>) => void) => {
        let timeoutId: NodeJS.Timeout | null = null
        
        return (...args: Parameters<T>) => {
            if (timeoutId) clearTimeout(timeoutId)
            timeoutId = setTimeout(() => func(...args), delay)
        }
    }
} 