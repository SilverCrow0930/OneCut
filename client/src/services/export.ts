// Export Types and Interfaces
interface ExportSettings {
    resolution: '480p' | '720p' | '1080p'
    fps: number
    quality: 'low' | 'medium' | 'high'
    quickExport?: boolean
    optimizationLevel?: 'auto' | 'speed' | 'quality' | 'balanced'
    allowProgressiveQuality?: boolean
}

interface ExportJob {
    id: string
    status: 'queued' | 'processing' | 'completed' | 'failed' | 'downloading'
    progress: number
    error?: string
    downloadUrl?: string
    createdAt: string
    completedAt?: string
}

interface TimelineClip {
    id: string
    type: 'video' | 'image' | 'audio' | 'text' | 'caption'
    assetId?: string
    trackId: string
    timelineStartMs: number
    timelineEndMs: number
    sourceStartMs: number
    sourceEndMs: number
    speed?: number
    volume?: number
    properties?: {
        externalAsset?: {
            url: string
            platform: string
        }
        text?: string
        fontSize?: number
        fontColor?: string
        fontFamily?: string
        fontWeight?: string
        backgroundColor?: string
        borderColor?: string
        borderWidth?: number
        position?: { x: number, y: number }
        captionStyle?: {
            backgroundColor?: string
            borderColor?: string
            borderWidth?: number
            padding?: number
            borderRadius?: number
            shadow?: boolean
            outline?: boolean
        }
        [key: string]: any
    }
}

interface TimelineTrack {
    id: string
    index: number
    type: 'video' | 'audio' | 'image' | 'text'
    name: string
}

// Progress and Status Callbacks
type ProgressCallback = (progress: number) => void
type StatusCallback = (status: string) => void
type ErrorCallback = (error: string) => void

class ExportService {
    private baseUrl: string
    private accessToken: string | null = null

    constructor() {
        this.baseUrl = process.env.NEXT_PUBLIC_API_URL || ''
    }

    setAccessToken(token: string | null) {
        this.accessToken = token
    }

    private getHeaders(): HeadersInit {
        const headers: HeadersInit = {
            'Content-Type': 'application/json'
        }

        if (this.accessToken) {
            headers['Authorization'] = `Bearer ${this.accessToken}`
        }

        return headers
    }

    /**
     * Comprehensive export method that handles the entire export process
     */
    async exportVideo(
        clips: TimelineClip[],
        tracks: TimelineTrack[],
        exportSettings: ExportSettings,
        callbacks?: {
            onProgress?: ProgressCallback
            onStatusChange?: StatusCallback
            onError?: ErrorCallback
        }
    ): Promise<{ success: boolean; downloadUrl?: string; error?: string }> {
        try {
            console.log('[ExportService] Starting export with', clips.length, 'clips and', tracks.length, 'tracks')

            // Start export job
            const startResult = await this.startExport(clips, tracks, exportSettings)
            if (!startResult.success || !startResult.jobId) {
                return { success: false, error: startResult.error || 'Failed to start export' }
            }

            const jobId = startResult.jobId
            console.log('[ExportService] Export job started:', jobId)

            // Poll for completion
            const pollResult = await this.pollExportStatus(
                jobId,
                callbacks?.onProgress,
                callbacks?.onStatusChange
            )

            if (!pollResult.success) {
                return { success: false, error: pollResult.error }
            }

            // Download the file
            if (pollResult.downloadUrl) {
                const filename = `video-export-${exportSettings.resolution}-${Date.now()}.mp4`
                await this.downloadFile(pollResult.downloadUrl, filename, jobId)
            }

            return { success: true, downloadUrl: pollResult.downloadUrl }

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown export error'
            console.error('[ExportService] Export failed:', errorMessage)
            callbacks?.onError?.(errorMessage)
            return { success: false, error: errorMessage }
        }
    }

    /**
     * Start a new export job on the server
     */
    async startExport(
        clips: TimelineClip[],
        tracks: TimelineTrack[],
        exportSettings: ExportSettings
    ): Promise<{ success: boolean; jobId?: string; error?: string }> {
        try {
            const response = await fetch(`${this.baseUrl}/api/v1/export/start`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({
                    clips,
                    tracks,
                    exportSettings
                })
            })

            const data = await response.json()

            if (!response.ok) {
                return {
                    success: false,
                    error: data.error || `HTTP ${response.status}: ${response.statusText}`
                }
            }

            return {
                success: true,
                jobId: data.jobId
            }

        } catch (error) {
            console.error('Export start error:', error)
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Network error'
            }
        }
    }

    /**
     * Check the status of an export job
     */
    async getExportStatus(jobId: string): Promise<{ success: boolean; job?: ExportJob; error?: string }> {
        try {
            const response = await fetch(`${this.baseUrl}/api/v1/export/status/${jobId}`, {
                headers: this.getHeaders()
            })

            const data = await response.json()

            if (!response.ok) {
                return {
                    success: false,
                    error: data.error || `HTTP ${response.status}: ${response.statusText}`
                }
            }

            return {
                success: true,
                job: data.job
            }

        } catch (error) {
            console.error('Export status error:', error)
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Network error'
            }
        }
    }

    /**
     * Cancel an export job
     */
    async cancelExport(jobId: string): Promise<{ success: boolean; error?: string }> {
        try {
            const response = await fetch(`${this.baseUrl}/api/v1/export/cancel/${jobId}`, {
                method: 'DELETE',
                headers: this.getHeaders()
            })

            const data = await response.json()

            if (!response.ok) {
                return {
                    success: false,
                    error: data.error || `HTTP ${response.status}: ${response.statusText}`
                }
            }

            return { success: true }

        } catch (error) {
            console.error('Export cancel error:', error)
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Network error'
            }
        }
    }

    /**
     * List export jobs for the current user
     */
    async listExportJobs(): Promise<{ success: boolean; jobs?: ExportJob[]; error?: string }> {
        try {
            const response = await fetch(`${this.baseUrl}/api/v1/export/jobs`, {
                headers: this.getHeaders()
            })

            const data = await response.json()

            if (!response.ok) {
                return {
                    success: false,
                    error: data.error || `HTTP ${response.status}: ${response.statusText}`
                }
            }

            return {
                success: true,
                jobs: data.jobs
            }

        } catch (error) {
            console.error('Export jobs list error:', error)
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Network error'
            }
        }
    }

    /**
     * Poll export status with automatic retries
     */
    async pollExportStatus(
        jobId: string,
        onProgress?: ProgressCallback,
        onStatusChange?: StatusCallback,
        pollInterval: number = 2000
    ): Promise<{ success: boolean; downloadUrl?: string; error?: string }> {
        return new Promise((resolve) => {
            const poll = async () => {
                const result = await this.getExportStatus(jobId)

                if (!result.success || !result.job) {
                    resolve({
                        success: false,
                        error: result.error || 'Failed to get export status'
                    })
                    return
                }

                const job = result.job

                // Update progress callback
                onProgress?.(job.progress)

                // Update status callback
                onStatusChange?.(job.status)

                // Check if job is complete
                if (job.status === 'completed') {
                    resolve({
                        success: true,
                        downloadUrl: job.downloadUrl
                    })
                    return
                }

                // Check if job failed
                if (job.status === 'failed') {
                    resolve({
                        success: false,
                        error: job.error || 'Export failed'
                    })
                    return
                }

                // Continue polling
                setTimeout(poll, pollInterval)
            }

            poll()
        })
    }

    /**
     * Download a file from URL with proper filename
     */
    async downloadFile(url: string, filename: string, jobId?: string): Promise<void> {
        try {
            console.log('[ExportService] Starting download for:', filename)

            // Method 1: Try direct link click first (fastest for signed URLs)
            try {
                const link = document.createElement('a')
                link.href = url
                link.download = filename
                link.style.display = 'none'
                link.target = '_blank'
                
                document.body.appendChild(link)
                
                const clickEvent = new MouseEvent('click', {
                    view: window,
                    bubbles: true,
                    cancelable: true
                })
                
                link.dispatchEvent(clickEvent)
                
                setTimeout(() => {
                    document.body.removeChild(link)
                }, 100)
                
                console.log('[ExportService] Direct download initiated')
                return
                
            } catch (directError) {
                console.warn('[ExportService] Direct download failed, trying fetch method:', directError)
            }

            // Method 2: Fetch and create blob (for CORS-enabled URLs)
            try {
                const response = await fetch(url, { 
                    mode: 'cors',
                    credentials: 'omit'
                })

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
                }

                console.log('[ExportService] Fetch successful, creating blob...')
                
                const blob = await response.blob()
                const blobUrl = URL.createObjectURL(blob)

                const link = document.createElement('a')
                link.href = blobUrl
                link.download = filename
                link.style.display = 'none'
                document.body.appendChild(link)
                link.click()
                
                setTimeout(() => {
                    document.body.removeChild(link)
                    URL.revokeObjectURL(blobUrl)
                }, 100)
                
                console.log('[ExportService] Blob download completed')
                return
                
            } catch (fetchError) {
                console.warn('[ExportService] Fetch download failed:', fetchError)
            }

            // Method 3: Use server proxy download (if jobId is available)
            if (jobId) {
                try {
                    console.log('[ExportService] Trying server proxy download...')
                    const proxyUrl = `${this.baseUrl}/api/v1/export/download/${jobId}`
                    
                    const link = document.createElement('a')
                    link.href = proxyUrl
                    link.download = filename
                    link.style.display = 'none'
                    
                    document.body.appendChild(link)
                    link.click()
                    
                    setTimeout(() => {
                        document.body.removeChild(link)
                    }, 100)
                    
                    console.log('[ExportService] Server proxy download initiated')
                    return
                    
                } catch (proxyError) {
                    console.warn('[ExportService] Server proxy download failed:', proxyError)
                }
            }

            // Method 4: Open in new window as final fallback
            console.log('[ExportService] Using fallback: opening in new window')
            const newWindow = window.open(url, '_blank')
            if (!newWindow) {
                throw new Error('Download failed - popup blocker may be enabled. Please allow popups and try again.')
            }

        } catch (error) {
            console.error('[ExportService] All download methods failed:', error)
            throw new Error(`Download failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
    }

    /**
     * Streaming download with progress callback
     */
    async downloadFileWithProgress(
        url: string, 
        filename: string, 
        onProgressUpdate?: (percent: number) => void, 
        jobId?: string
    ): Promise<void> {
        return new Promise(async (resolve, reject) => {
            try {
                console.log('[ExportService] Starting progress download for:', filename)
                
                // Try to fetch with progress tracking first
                try {
                    const response = await fetch(url, { 
                        mode: 'cors',
                        credentials: 'omit'
                    })
                    
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
                    }

                    if (!response.body) {
                        throw new Error('Response body not available for streaming')
                    }

                    const contentLength = Number(response.headers.get('Content-Length')) || 0
                    const reader = response.body.getReader()
                    const chunks: Uint8Array[] = []
                    let received = 0

                    console.log('[ExportService] Content length:', contentLength)
                    onProgressUpdate?.(0)

                    while (true) {
                        const { done, value } = await reader.read()
                        if (done) break
                        if (value) {
                            chunks.push(value)
                            received += value.length
                            if (contentLength > 0) {
                                const percent = Math.min(Math.round((received / contentLength) * 100), 100)
                                onProgressUpdate?.(percent)
                            }
                        }
                    }

                    console.log('[ExportService] Download completed, creating blob...')
                    const blob = new Blob(chunks, { type: 'video/mp4' })
                    const blobUrl = URL.createObjectURL(blob)

                    const link = document.createElement('a')
                    link.href = blobUrl
                    link.download = filename
                    link.style.display = 'none'
                    document.body.appendChild(link)
                    link.click()

                    setTimeout(() => {
                        document.body.removeChild(link)
                        URL.revokeObjectURL(blobUrl)
                    }, 100)

                    onProgressUpdate?.(100)
                    console.log('[ExportService] Progress download completed successfully')
                    resolve()
                    
                } catch (streamError) {
                    console.warn('[ExportService] Streaming download failed, falling back to simple download:', streamError)
                    
                    // Fallback to simple download without progress
                    await this.downloadFile(url, filename, jobId)
                    onProgressUpdate?.(100)
                    resolve()
                }

            } catch (error) {
                console.error('[ExportService] Progress download failed:', error)
                reject(error)
            }
        })
    }
}

// Export singleton instance and types
export const exportService = new ExportService()
export type { 
    ExportSettings, 
    ExportJob, 
    TimelineClip, 
    TimelineTrack,
    ProgressCallback,
    StatusCallback,
    ErrorCallback
} 