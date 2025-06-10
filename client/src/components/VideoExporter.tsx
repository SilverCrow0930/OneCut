import { Track, Clip } from '@/types/editor'

interface VideoExporterProps {
    clips: Clip[]
    tracks: Track[]
    exportType: '480p' | '720p' | '1080p'
    onError: (error: string) => void
    accessToken?: string | null
    quickExport?: boolean
    onProgress?: (progress: number) => void
    optimizationLevel?: 'auto' | 'speed' | 'quality' | 'balanced'
    allowProgressiveQuality?: boolean
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

export class VideoExporter {
    private clips: Clip[]
    private tracks: Track[]
    private exportType: '480p' | '720p' | '1080p'
    private onError: (error: string) => void
    private accessToken?: string | null
    private onProgress: ((progress: number) => void) | undefined
    private quickExport?: boolean
    private jobId?: string
    private pollInterval?: NodeJS.Timeout

    constructor({ clips, tracks, exportType, onError, accessToken, onProgress, quickExport }: VideoExporterProps) {
        this.clips = clips
        this.tracks = tracks
        this.exportType = exportType
        this.onError = onError
        this.accessToken = accessToken
        this.onProgress = onProgress
        this.quickExport = quickExport
    }

    async processVideo() {
        try {
            console.log('[VideoExporter] Starting professional server-side export...')
            console.log('[VideoExporter] Clips:', this.clips.length)
            console.log('[VideoExporter] Tracks:', this.tracks.length)

            // Start export job on server
            const jobId = await this.startExportJob()
            this.jobId = jobId

            console.log(`[VideoExporter] Export job started: ${jobId}`)

            // Poll for progress
            await this.pollForCompletion()

        } catch (error) {
            console.error('[VideoExporter] Export failed:', error)
            this.onError(error instanceof Error ? error.message : 'Export failed')
        }
    }

    private async startExportJob(): Promise<string> {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || ''
        const url = `${baseUrl}/api/v1/export/start`

        const exportSettings = {
            resolution: this.exportType,
            fps: 30,
            quality: this.quickExport ? 'low' : 'medium',
            quickExport: this.quickExport
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(this.accessToken ? { 'Authorization': `Bearer ${this.accessToken}` } : {})
            },
            body: JSON.stringify({
                clips: this.clips,
                tracks: this.tracks,
                exportSettings
            })
        })

        if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.error || `Export failed: ${response.status}`)
        }

        const data = await response.json()
        return data.jobId
    }

    private async pollForCompletion(): Promise<void> {
        return new Promise((resolve, reject) => {
            const poll = async () => {
                try {
                    const job = await this.checkJobStatus()
                    
                    if (this.onProgress) {
                        this.onProgress(job.progress)
                    }

                    console.log(`[VideoExporter] Job ${job.id}: ${job.status} (${job.progress}%)`)

                    if (job.status === 'completed') {
                        if (this.pollInterval) {
                            clearInterval(this.pollInterval)
                        }
                        
                        // Download the file
                        if (job.downloadUrl) {
                            try {
                                await this.downloadFile(job.downloadUrl)
                                resolve()
                            } catch (downloadError) {
                                reject(downloadError)
                            }
                        } else {
                            reject(new Error('Export completed but no download URL provided'))
                        }
                    } else if (job.status === 'failed') {
                        if (this.pollInterval) {
                            clearInterval(this.pollInterval)
                        }
                        reject(new Error(job.error || 'Export failed'))
                    }
                    // Continue polling if status is 'queued' or 'processing'
                } catch (error) {
                    if (this.pollInterval) {
                        clearInterval(this.pollInterval)
                    }
                    reject(error)
                }
            }

            // Poll immediately, then every 2 seconds
            poll()
            this.pollInterval = setInterval(poll, 2000)
        })
    }

    private async checkJobStatus(): Promise<ExportJob> {
        if (!this.jobId) {
            throw new Error('No job ID available')
        }

        const baseUrl = process.env.NEXT_PUBLIC_API_URL || ''
        const url = `${baseUrl}/api/v1/export/status/${this.jobId}`

        const response = await fetch(url, {
            headers: this.accessToken ? { 'Authorization': `Bearer ${this.accessToken}` } : {}
        })

        if (!response.ok) {
            throw new Error(`Failed to check job status: ${response.status}`)
        }

        const data = await response.json()
        return data.job
    }

    private async downloadFile(downloadUrl: string): Promise<void> {
        try {
            console.log('[VideoExporter] Starting download...')
            
            const filename = `video-export-${this.exportType}-${Date.now()}.mp4`
            
            // Use the improved download method from exportService
            const { exportService } = await import('../services/export')
            await exportService.downloadFile(downloadUrl, filename)
            
            console.log('[VideoExporter] Download completed successfully')
            
        } catch (error) {
            console.error('[VideoExporter] Download failed:', error)
            this.onError(`Download failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
    }

    public cancelExport(): void {
        if (this.pollInterval) {
            clearInterval(this.pollInterval)
        }

        if (this.jobId) {
            // Cancel the job on the server
            const baseUrl = process.env.NEXT_PUBLIC_API_URL || ''
            const url = `${baseUrl}/api/v1/export/cancel/${this.jobId}`
            
            fetch(url, {
                method: 'DELETE',
                headers: this.accessToken ? { 'Authorization': `Bearer ${this.accessToken}` } : {}
            }).catch(error => {
                console.warn('Failed to cancel export job:', error)
            })
        }
    }
} 