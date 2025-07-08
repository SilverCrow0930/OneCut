// Export Types and Interfaces
interface ExportSettings {
    resolution: '480p' | '720p' | '1080p'
    fps: number
    quality: 'low' | 'medium' | 'high'
    quickExport?: boolean
    optimizationLevel?: 'auto' | 'speed' | 'quality' | 'balanced'
    allowProgressiveQuality?: boolean
    aspectRatio?: 'horizontal' | 'vertical'
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
        style?: {
            fontSize?: string | number
            fontColor?: string
            color?: string
            fontFamily?: string
            fontWeight?: string
            fontStyle?: string
            textAlign?: string
            backgroundColor?: string
            borderColor?: string
            borderWidth?: number
            [key: string]: any
        }
        // Legacy individual properties for backward compatibility
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
     * Poll export status with adaptive polling intervals to reduce server load
     */
    async pollExportStatus(
        jobId: string,
        onProgress?: ProgressCallback,
        onStatusChange?: StatusCallback,
        initialInterval: number = 1000, // Start with 1 second for immediate feedback
        maxPolls: number = 300 // Maximum 300 polls (about 10-15 minutes with adaptive intervals)
    ): Promise<{ success: boolean; downloadUrl?: string; error?: string }> {
        return new Promise((resolve) => {
            let pollCount = 0
            let lastProgress = 0
            let lastStatus = ''
            let consecutiveNoChangeCount = 0
            
            const getAdaptiveInterval = (pollCount: number, progress: number, status: string): number => {
                // Much slower polling to reduce server load by 80%
                
                // Initial polls - still need some feedback but much slower
                if (pollCount < 2) return 3000 // 3 seconds (was 1s)
                
                // Early stages (0-10%) - very slow since not much happens
                if (progress < 10) return 15000 // 15 seconds (was 2s)
                
                // Active processing (10-90%) - slow but steady
                if (progress >= 10 && progress < 90) return 20000 // 20 seconds (was 4s)
                
                // Final stages (90-100%) - moderate speed for completion
                if (progress >= 90) return 8000 // 8 seconds (was 2s)
                
                // If status is 'queued' and hasn't changed, very slow
                if (status === 'queued' && consecutiveNoChangeCount > 1) return 30000 // 30 seconds (was 6s)
                
                // If we've been polling for a long time, extremely slow
                if (pollCount > 20) return 45000 // 45 seconds (was 8s)
                
                // Default slow polling
                return 12000 // 12 seconds (was 3s)
            }

            const poll = async () => {
                try {
                    // Check if we've exceeded maximum polls
                    if (pollCount >= maxPolls) {
                        console.error(`[ExportService] Maximum polls (${maxPolls}) exceeded for job ${jobId}`)
                        resolve({
                            success: false,
                            error: 'Export timed out - polling limit reached'
                        })
                        return
                    }

                    const result = await this.getExportStatus(jobId)

                    if (!result.success || !result.job) {
                        resolve({
                            success: false,
                            error: result.error || 'Failed to get export status'
                        })
                        return
                    }

                    const job = result.job
                    pollCount++

                    // Track changes to implement adaptive polling
                    const hasProgressChanged = job.progress !== lastProgress
                    const hasStatusChanged = job.status !== lastStatus
                    
                    if (!hasProgressChanged && !hasStatusChanged) {
                        consecutiveNoChangeCount++
                    } else {
                        consecutiveNoChangeCount = 0
                    }

                    // Only call callbacks if something actually changed
                    if (hasProgressChanged) {
                        onProgress?.(job.progress)
                        lastProgress = job.progress
                    }

                    if (hasStatusChanged) {
                        onStatusChange?.(job.status)
                        lastStatus = job.status
                    }

                    console.log(`[ExportService] Poll ${pollCount}/${maxPolls}: ${job.status} ${job.progress}% (no change: ${consecutiveNoChangeCount})`)

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

                    // Calculate next poll interval adaptively
                    const nextInterval = getAdaptiveInterval(pollCount, job.progress, job.status)
                    
                    // Add minimal jitter to prevent thundering herd (reduced since we're polling less frequently)
                    const jitter = Math.random() * 1000 // 0-1000ms jitter
                    const finalInterval = nextInterval + jitter

                    console.log(`[ExportService] Next poll in ${Math.round(finalInterval)}ms`)
                    
                    // Continue polling with adaptive interval
                    setTimeout(poll, finalInterval)
                    
                } catch (error) {
                    console.error('[ExportService] Polling error:', error)
                    
                    // On error, increment poll count and check limit
                    pollCount++
                    if (pollCount >= maxPolls) {
                        resolve({
                            success: false,
                            error: 'Export timed out - polling limit reached due to errors'
                        })
                        return
                    }
                    
                    // On error, wait longer before retrying
                    setTimeout(poll, 5000)
                }
            }

            // Start polling immediately
            poll()
        })
    }

    /**
     * Download a file from URL with proper filename - fixed to prevent duplicate downloads
     */
    async downloadFile(url: string, filename: string, jobId?: string): Promise<void> {
        console.log('[ExportService] Starting download for:', filename)

        // First, try to determine the best method based on URL type
        const isSignedGoogleUrl = url.includes('storage.googleapis.com') && url.includes('X-Goog-Signature')
        const isExternalUrl = !url.startsWith(this.baseUrl)
        
        // Method 1: For signed URLs (Google Cloud Storage), use direct link click
        if (isSignedGoogleUrl) {
            console.log('[ExportService] Using direct download for signed URL')
            return this.downloadWithDirectLink(url, filename)
        }
        
        // Method 2: For external URLs, try fetch first (better error handling)
        if (isExternalUrl) {
            console.log('[ExportService] Using fetch download for external URL')
            try {
                return await this.downloadWithFetch(url, filename)
            } catch (error) {
                console.warn('[ExportService] Fetch download failed, trying direct link:', error)
                return this.downloadWithDirectLink(url, filename)
            }
        }
        
        // Method 3: For internal URLs, use server proxy if available
        if (jobId) {
            console.log('[ExportService] Using server proxy download for internal URL')
            try {
                return await this.downloadWithServerProxy(jobId, filename)
            } catch (error) {
                console.warn('[ExportService] Server proxy download failed, trying direct link:', error)
                return this.downloadWithDirectLink(url, filename)
            }
        }
        
        // Method 4: Fallback to direct link
        console.log('[ExportService] Using direct link download as fallback')
        return this.downloadWithDirectLink(url, filename)
    }

    /**
     * Download using direct link click (most compatible)
     */
    private downloadWithDirectLink(url: string, filename: string): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                const link = document.createElement('a')
                link.href = url
                link.download = filename
                link.style.display = 'none'
                link.target = '_blank'
                
                document.body.appendChild(link)
                
                // Add a small delay to ensure DOM is updated
                setTimeout(() => {
                    try {
                        link.click()
                        console.log('[ExportService] Direct download link clicked')
                        
                        // Clean up after a delay
                        setTimeout(() => {
                            try {
                                document.body.removeChild(link)
                            } catch (cleanupError) {
                                // Ignore cleanup errors
                            }
                        }, 1000)
                        
                        resolve()
                    } catch (clickError) {
                        document.body.removeChild(link)
                        reject(new Error(`Direct download failed: ${clickError instanceof Error ? clickError.message : 'Unknown error'}`))
                    }
                }, 10)
                
            } catch (error) {
                reject(new Error(`Direct download setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`))
            }
        })
    }

    /**
     * Download using fetch and blob creation
     */
    private async downloadWithFetch(url: string, filename: string): Promise<void> {
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

        return new Promise((resolve, reject) => {
            try {
                const link = document.createElement('a')
                link.href = blobUrl
                link.download = filename
                link.style.display = 'none'
                document.body.appendChild(link)
                
                setTimeout(() => {
                    try {
                        link.click()
                        console.log('[ExportService] Blob download completed')
                        
                        // Clean up after a delay
                        setTimeout(() => {
                            try {
                                document.body.removeChild(link)
                                URL.revokeObjectURL(blobUrl)
                            } catch (cleanupError) {
                                // Ignore cleanup errors
                            }
                        }, 1000)
                        
                        resolve()
                    } catch (clickError) {
                        document.body.removeChild(link)
                        URL.revokeObjectURL(blobUrl)
                        reject(new Error(`Blob download failed: ${clickError instanceof Error ? clickError.message : 'Unknown error'}`))
                    }
                }, 10)
                
            } catch (error) {
                URL.revokeObjectURL(blobUrl)
                reject(new Error(`Blob download setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`))
            }
        })
    }

    /**
     * Download using server proxy
     */
    private async downloadWithServerProxy(jobId: string, filename: string): Promise<void> {
        const proxyUrl = `${this.baseUrl}/api/v1/export/download/${jobId}`
        
        return new Promise((resolve, reject) => {
            try {
                const link = document.createElement('a')
                link.href = proxyUrl
                link.download = filename
                link.style.display = 'none'
                
                document.body.appendChild(link)
                
                setTimeout(() => {
                    try {
                        link.click()
                        console.log('[ExportService] Server proxy download initiated')
                        
                        // Clean up after a delay
                        setTimeout(() => {
                            try {
                                document.body.removeChild(link)
                            } catch (cleanupError) {
                                // Ignore cleanup errors
                            }
                        }, 1000)
                        
                        resolve()
                    } catch (clickError) {
                        document.body.removeChild(link)
                        reject(new Error(`Server proxy download failed: ${clickError instanceof Error ? clickError.message : 'Unknown error'}`))
                    }
                }, 10)
                
            } catch (error) {
                reject(new Error(`Server proxy download setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`))
            }
        })
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