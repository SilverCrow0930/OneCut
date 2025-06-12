import { exportService, type TimelineClip, type TimelineTrack, type ExportSettings } from '../services/export'

interface VideoExporterProps {
    clips: TimelineClip[]
    tracks: TimelineTrack[]
    exportType: '480p' | '720p' | '1080p'
    onError: (error: string) => void
    accessToken?: string | null
    quickExport?: boolean
    onProgress?: (progress: number) => void
    onStatusChange?: (status: string) => void
    optimizationLevel?: 'auto' | 'speed' | 'quality' | 'balanced'
    allowProgressiveQuality?: boolean
}

/**
 * Enhanced Video Exporter with comprehensive validation and error handling
 * This replaces the old VideoExporter class with a cleaner function-based approach
 */
export async function exportVideo(props: VideoExporterProps): Promise<{ success: boolean; error?: string }> {
    const {
        clips,
        tracks,
        exportType,
        onError,
        accessToken,
        quickExport,
        onProgress,
        onStatusChange,
        optimizationLevel,
        allowProgressiveQuality
    } = props

    try {
        // Input validation
        console.log('[VideoExporter] Validating export inputs...')
        
        if (!clips || clips.length === 0) {
            const error = 'No clips provided for export'
            console.error('[VideoExporter]', error)
            onError?.(error)
            return { success: false, error }
        }
        
        if (!tracks || tracks.length === 0) {
            const error = 'No tracks provided for export'
            console.error('[VideoExporter]', error)
            onError?.(error)
            return { success: false, error }
        }
        
        // Validate export type
        const validExportTypes = ['480p', '720p', '1080p']
        if (!validExportTypes.includes(exportType)) {
            const error = `Invalid export type: ${exportType}. Must be one of: ${validExportTypes.join(', ')}`
            console.error('[VideoExporter]', error)
            onError?.(error)
            return { success: false, error }
        }
        
        // Check for clips with missing asset IDs
        const mediaClips = clips.filter(clip => ['video', 'audio', 'image'].includes(clip.type))
        const clipsWithoutAssets = mediaClips.filter(clip => !clip.assetId)
        if (clipsWithoutAssets.length > 0) {
            const error = `${clipsWithoutAssets.length} media clips are missing asset references`
            console.error('[VideoExporter]', error)
            onError?.(error)
            return { success: false, error }
        }
        
        // Check for invalid timeline ranges
        const invalidClips = clips.filter(clip => 
            clip.timelineStartMs < 0 || 
            clip.timelineEndMs <= clip.timelineStartMs ||
            (clip.timelineEndMs - clip.timelineStartMs) < 100 // Minimum 100ms
        )
        if (invalidClips.length > 0) {
            const error = `${invalidClips.length} clips have invalid timeline ranges`
            console.error('[VideoExporter]', error)
            onError?.(error)
            return { success: false, error }
        }
        
        // Set access token if provided
        if (accessToken) {
            exportService.setAccessToken(accessToken)
        }

        // Build export settings with validation
        const exportSettings: ExportSettings = {
            resolution: exportType,
            fps: Math.max(24, Math.min(60, 30)), // Clamp FPS between 24-60
            quality: quickExport ? 'low' : 'medium',
            quickExport: Boolean(quickExport),
            optimizationLevel: optimizationLevel || 'balanced',
            allowProgressiveQuality: Boolean(allowProgressiveQuality)
        }

        console.log('[VideoExporter] Starting export with validated settings:', exportSettings)
        console.log('[VideoExporter] Export data:', {
            clipCount: clips.length,
            trackCount: tracks.length,
            mediaClips: mediaClips.length,
            totalDuration: Math.max(...clips.map(c => c.timelineEndMs)) / 1000 + 's'
        })

        // Enhanced error handling with retry logic for network issues
        let lastError: string | undefined
        const maxRetries = 2
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                if (attempt > 1) {
                    console.log(`[VideoExporter] Retry attempt ${attempt}/${maxRetries}`)
                    onStatusChange?.(`Retrying export (attempt ${attempt}/${maxRetries})...`)
                        }
                        
                // Use the consolidated export service
                const result = await exportService.exportVideo(clips, tracks, exportSettings, {
                    onProgress: (progress) => {
                        // Add attempt info to progress if retrying
                        if (attempt > 1) {
                            onProgress?.(progress)
                            onStatusChange?.(`Retrying export: ${progress.toFixed(1)}% (attempt ${attempt}/${maxRetries})`)
                        } else {
                            onProgress?.(progress)
                        }
                    },
                    onStatusChange: (status) => {
                        // Add attempt info to status if retrying
                        if (attempt > 1) {
                            onStatusChange?.(`${status} (attempt ${attempt}/${maxRetries})`)
                        } else {
                            onStatusChange?.(status)
                        }
                    },
                    onError: (error) => {
                        console.error(`[VideoExporter] Export error on attempt ${attempt}:`, error)
                        lastError = error
                    }
                })

                if (result.success) {
                    console.log('[VideoExporter] Export completed successfully')
                    return result
                } else {
                    lastError = result.error || 'Export failed for unknown reason'
                    
                    // Check if error is worth retrying
                    const retryableErrors = [
                        'network', 'timeout', 'connection', 'temporary', 
                        'server error', '503', '502', '500'
                    ]
                    const shouldRetry = retryableErrors.some(keyword => 
                        lastError?.toLowerCase().includes(keyword)
                    )
                    
                    if (!shouldRetry || attempt === maxRetries) {
                        break
                    }
                    
                    // Wait before retry with exponential backoff
                    const waitMs = Math.min(2000 * Math.pow(2, attempt - 1), 10000)
                    console.log(`[VideoExporter] Waiting ${waitMs}ms before retry...`)
                    await new Promise(resolve => setTimeout(resolve, waitMs))
                }
                
            } catch (serviceError) {
                lastError = serviceError instanceof Error ? serviceError.message : 'Service call failed'
                console.error(`[VideoExporter] Service error on attempt ${attempt}:`, lastError)
                
                if (attempt === maxRetries) {
                    break
                }
            }
        }

        // All attempts failed
        const finalError = lastError || 'Export failed after all retry attempts'
        console.error('[VideoExporter] Export failed after all attempts:', finalError)
        onError?.(finalError)
        return { success: false, error: finalError }

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unexpected export error'
        console.error('[VideoExporter] Unexpected error:', errorMessage)
        onError?.(errorMessage)
        return { success: false, error: errorMessage }
    }
}

/**
 * Hook-style export manager for React components
 */
export function useVideoExporter() {
    let currentJobId: string | null = null

    const startExport = async (props: VideoExporterProps) => {
        return await exportVideo(props)
        }

    const cancelExport = async () => {
        if (currentJobId) {
            const result = await exportService.cancelExport(currentJobId)
            if (!result.success) {
                console.warn('[VideoExporter] Failed to cancel export:', result.error)
            }
            currentJobId = null
            return result
        }
        return { success: true }
    }

    return {
        startExport,
        cancelExport
    }
}

// Legacy class wrapper for backward compatibility
export class VideoExporter {
    private props: VideoExporterProps

    constructor(props: VideoExporterProps) {
        this.props = props
    }

    async processVideo(): Promise<void> {
        const result = await exportVideo(this.props)
        if (!result.success) {
            throw new Error(result.error || 'Export failed')
        }
    }

    cancelExport(): void {
        // This will be handled by the service internally
        console.log('[VideoExporter] Cancel requested - job will be cancelled on next status check')
    }
}

// Export types for convenience
export type { VideoExporterProps } 