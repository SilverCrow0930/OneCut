interface ExportSettings {
    resolution: '480p' | '720p' | '1080p'
    fps: number
    quality: 'low' | 'medium' | 'high'
    quickExport?: boolean
}

interface ExportJob {
    id: string
    status: 'queued' | 'processing' | 'completed' | 'failed'
    progress: number
    error?: string
    downloadUrl?: string
    createdAt: string
    completedAt?: string
}

interface TimelineClip {
    id: string
    type: 'video' | 'image' | 'audio' | 'text'
    assetId?: string
    trackId: string
    timelineStartMs: number
    timelineEndMs: number
    sourceStartMs: number
    sourceEndMs: number
    speed?: number
    properties?: {
        externalAsset?: {
            url: string
            platform: string
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
        onProgress?: (progress: number) => void,
        onStatusChange?: (status: string) => void,
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
                if (onProgress) {
                    onProgress(job.progress)
                }

                // Update status callback
                if (onStatusChange) {
                    onStatusChange(job.status)
                }

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
    async downloadFile(url: string, filename: string): Promise<void> {
        try {
            // Create a temporary link element
            const link = document.createElement('a')
            link.href = url
            link.download = filename
            link.style.display = 'none'

            // Add to DOM and trigger download
            document.body.appendChild(link)
            link.click()

            // Clean up
            setTimeout(() => {
                document.body.removeChild(link)
            }, 100)

        } catch (error) {
            console.error('Download error:', error)
            throw new Error('Failed to download file')
        }
    }
}

// Export singleton instance
export const exportService = new ExportService()
export type { ExportSettings, ExportJob, TimelineClip, TimelineTrack } 