import React, { useEffect, useState, useRef } from 'react'

interface PerformanceStats {
    fps: number
    renderTime: number
    memoryUsage: number
    dragEvents: number
}

interface PerformanceMonitorProps {
    enabled?: boolean
    position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
}

export default function PerformanceMonitor({ 
    enabled = false, 
    position = 'top-right' 
}: PerformanceMonitorProps) {
    const [stats, setStats] = useState<PerformanceStats>({
        fps: 0,
        renderTime: 0,
        memoryUsage: 0,
        dragEvents: 0
    })

    const frameCount = useRef(0)
    const lastTime = useRef(performance.now())
    const renderStartTime = useRef(0)
    const dragEventCount = useRef(0)

    useEffect(() => {
        if (!enabled) return

        let animationId: number

        const measurePerformance = () => {
            const now = performance.now()
            frameCount.current++

            // Calculate FPS every second
            if (now - lastTime.current >= 1000) {
                const fps = Math.round((frameCount.current * 1000) / (now - lastTime.current))
                
                // Get memory usage if available
                const memory = (performance as any).memory
                const memoryUsage = memory ? Math.round(memory.usedJSHeapSize / 1024 / 1024) : 0

                setStats(prev => ({
                    ...prev,
                    fps,
                    memoryUsage,
                    dragEvents: dragEventCount.current
                }))

                frameCount.current = 0
                lastTime.current = now
                dragEventCount.current = 0
            }

            animationId = requestAnimationFrame(measurePerformance)
        }

        // Track drag events
        const handleMouseMove = () => {
            dragEventCount.current++
        }

        document.addEventListener('mousemove', handleMouseMove)
        animationId = requestAnimationFrame(measurePerformance)

        return () => {
            cancelAnimationFrame(animationId)
            document.removeEventListener('mousemove', handleMouseMove)
        }
    }, [enabled])

    if (!enabled) return null

    const positionClasses = {
        'top-left': 'top-4 left-4',
        'top-right': 'top-4 right-4',
        'bottom-left': 'bottom-4 left-4',
        'bottom-right': 'bottom-4 right-4'
    }

    return (
        <div className={`fixed ${positionClasses[position]} z-50 bg-black/80 text-white text-xs p-3 rounded-lg font-mono`}>
            <div className="space-y-1">
                <div className={`flex justify-between gap-4 ${stats.fps < 30 ? 'text-red-400' : stats.fps < 50 ? 'text-yellow-400' : 'text-green-400'}`}>
                    <span>FPS:</span>
                    <span>{stats.fps}</span>
                </div>
                <div className="flex justify-between gap-4">
                    <span>Memory:</span>
                    <span>{stats.memoryUsage}MB</span>
                </div>
                <div className="flex justify-between gap-4">
                    <span>Drag Events/s:</span>
                    <span>{stats.dragEvents}</span>
                </div>
            </div>
        </div>
    )
} 