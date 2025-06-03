import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'
import { Track, Clip } from '@/types/editor'

interface VideoExporterProps {
    clips: Clip[]
    tracks: Track[]
    exportType: 'studio' | 'social' | 'web'
    onError: (error: string) => void
    accessToken?: string | null
    quickExport?: boolean
    onProgress?: (progress: number) => void
}

async function fetchAssetUrls(assetIds: string[], accessToken?: string | null): Promise<Map<string, string>> {
    const urls = new Map<string, string>()
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || ''
    const errors: string[] = []
    
    console.log('[VideoExporter] Fetching asset URLs for:', assetIds.length, 'assets')
    
    for (const id of assetIds) {
        try {
            const url = `${baseUrl}/api/v1/assets/${id}/url`
            console.log(`[VideoExporter] Fetching asset URL: ${url}`)
            
            const response = await fetch(url, {
                headers: accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}
            })
            
            if (!response.ok) {
                const errorText = await response.text()
                const errorMsg = `Asset ${id}: ${response.status} ${response.statusText} - ${errorText}`
                console.error('[VideoExporter] Asset fetch failed:', errorMsg)
                errors.push(errorMsg)
                continue
            }
            
            const data = await response.json()
            if (data.url) {
                urls.set(id, data.url)
                console.log(`[VideoExporter] Successfully fetched URL for asset: ${id}`)
            } else {
                const errorMsg = `Asset ${id}: Response missing URL field`
                console.error('[VideoExporter] Asset URL missing:', errorMsg)
                errors.push(errorMsg)
            }
        } catch (error) {
            const errorMsg = `Asset ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`
            console.error('[VideoExporter] Asset fetch exception:', errorMsg)
            errors.push(errorMsg)
        }
    }
    
    if (errors.length > 0) {
        console.error('[VideoExporter] Asset loading errors:', errors)
        throw new Error(`Failed to fetch asset URLs:\n${errors.join('\n')}`)
    }
    
    return urls
}

export class VideoExporter {
    private clips: Clip[]
    private tracks: Track[]
    private exportType: 'studio' | 'social' | 'web'
    private onError: (error: string) => void
    private ffmpeg: FFmpeg | null = null
    private assetUrls: Map<string, string>
    private accessToken?: string | null
    private onProgress: ((progress: number) => void) | undefined
    private quickExport?: boolean

    constructor({ clips, tracks, exportType, onError, accessToken, onProgress, quickExport }: VideoExporterProps) {
        this.clips = clips
        this.tracks = tracks
        this.exportType = exportType
        this.onError = onError
        this.assetUrls = new Map()
        this.accessToken = accessToken
        this.onProgress = onProgress
        this.quickExport = quickExport
    }

    private async initializeFFmpeg() {
        if (this.ffmpeg) return this.ffmpeg
        try {
            this.ffmpeg = new FFmpeg()
            
            // Check for SharedArrayBuffer support (required for FFmpeg)
            if (typeof SharedArrayBuffer === 'undefined') {
                throw new Error('SharedArrayBuffer is not available. This browser may not support video export. Please try Chrome or Firefox with appropriate security headers.')
            }
            
            await this.ffmpeg.load()
            return this.ffmpeg
        } catch (error) {
            console.error('FFmpeg initialization error:', error)
            throw new Error(`Failed to initialize FFmpeg: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
    }

    private async loadAssetUrls() {
        try {
            const assetIds = this.clips
                .filter(clip => (clip.type === 'video' || clip.type === 'image' || clip.type === 'audio') && clip.assetId)
                .map(clip => clip.assetId!)

            if (assetIds.length === 0) {
                throw new Error('No valid assets found in clips')
            }

            console.log('[VideoExporter] Loading asset URLs for IDs:', assetIds)
            this.assetUrls = await fetchAssetUrls(assetIds, this.accessToken)

            if (this.assetUrls.size === 0) {
                throw new Error('Failed to fetch any asset URLs. Check if assets exist on the server.')
            }

            // Log successful and failed asset loads
            const successfulAssets = Array.from(this.assetUrls.keys())
            const failedAssets = assetIds.filter(id => !this.assetUrls.has(id))
            
            if (successfulAssets.length > 0) {
                console.log('[VideoExporter] Successfully loaded asset URLs:', successfulAssets)
            }
            if (failedAssets.length > 0) {
                console.error('[VideoExporter] Failed to load asset URLs:', failedAssets)
                throw new Error(`Failed to load ${failedAssets.length} asset(s): ${failedAssets.join(', ')}. These assets may not exist on the server.`)
            }
        } catch (error) {
            console.error('[VideoExporter] Asset loading error:', error)
            throw new Error(`Failed to load asset URLs: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
    }

    private getFileExtension(url: string): string {
        try {
            // Remove query params
            const cleanUrl = url.split('?')[0]
            // Get last path segment
            const path = cleanUrl.split('/').pop() || ''
            // Get extension
            const ext = path.includes('.') ? path.split('.').pop() : ''
            // Only allow common video/image/audio extensions
            const allowed = ['mp4', 'mov', 'webm', 'mkv', 'avi', 'mp3', 'wav', 'aac', 'jpg', 'jpeg', 'png', 'gif']
            if (ext && allowed.includes(ext.toLowerCase())) return ext.toLowerCase()
            return 'mp4'
        } catch {
            return 'mp4'
        }
    }

    private generateSafeFilename(assetId: string, ext: string): string {
        // Extract just the first 8 characters of the assetId, removing any non-alphanumeric characters
        const cleanId = assetId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8)
        return `input_${cleanId}.${ext}`
    }

    private async verifyFFmpegFile(ffmpeg: FFmpeg, filename: string): Promise<boolean> {
        try {
            const files = await ffmpeg.listDir('/')
            return files.some(file => file.name === filename)
        } catch (error) {
            console.error(`Error verifying file ${filename}:`, error)
            return false
        }
    }

    async processVideo() {
        try {
            console.log('[VideoExporter] Starting processVideo')

            // Check if FFmpeg is available
            let ffmpegAvailable = true
            try {
                await this.initializeFFmpeg()
            } catch (error) {
                console.warn('[VideoExporter] FFmpeg not available:', error)
                ffmpegAvailable = false
            }

            // If FFmpeg is not available, use fallback method
            if (!ffmpegAvailable) {
                console.log('[VideoExporter] Using fallback export method')
                return await this.processFallbackExport()
            }

            console.log('[VideoExporter] tracks:', this.tracks)
            console.log('[VideoExporter] clips:', this.clips)

            if (!Array.isArray(this.tracks) || !Array.isArray(this.clips)) {
                throw new Error('VideoExporter: tracks or clips is not an array')
            }

            const ffmpeg = await this.initializeFFmpeg()
            if (!ffmpeg) throw new Error('FFmpeg not initialized')

            await this.loadAssetUrls()
            console.log('[VideoExporter] assetUrls:', this.assetUrls)

            // List files before any writing
            try {
                const filesBefore = await ffmpeg.listDir('/')
                console.log('[VideoExporter] Files in FFmpeg FS before writing inputs:', filesBefore)
            } catch (e) {
                console.error('[VideoExporter] Could not list files before writing inputs:', e)
            }

            // Sort tracks by index (lowest index on top)
            const sortedTracks = [...this.tracks].sort((a, b) => a.index - b.index)
            const trackClips = sortedTracks.map(track => ({
                track,
                clips: this.clips.filter(clip => clip.trackId === track.id)
            }))

            // Filter valid media clips (with asset and assetUrl)
            const validMediaClips = this.clips.filter(
                clip =>
                    (clip.type === 'video' || clip.type === 'image' || clip.type === 'audio') &&
                    clip.assetId &&
                    this.assetUrls.get(clip.assetId)
            )
            console.log('[VideoExporter] validMediaClips:', validMediaClips)

            if (validMediaClips.length === 0) {
                throw new Error('No valid media clips found for export')
            }

            // Download and prepare all valid assets
            const processedFiles = new Map<string, string>()
            for (let i = 0; i < validMediaClips.length; i++) {
                const clip = validMediaClips[i]
                try {
                    const assetUrl = this.assetUrls.get(clip.assetId!)
                    if (!assetUrl) continue

                    console.log(`[VideoExporter] Fetching asset for clip ${i}:`, assetUrl)
                    const response = await fetch(assetUrl)
                    if (!response.ok) {
                        throw new Error(`Failed to fetch asset: ${response.status} ${response.statusText}`)
                    }

                    const blob = await response.blob()
                    const ext = this.getFileExtension(assetUrl)
                    const safeFilename = `input_${i}.${ext}`
                    processedFiles.set(clip.assetId!, safeFilename)

                    console.log(`[VideoExporter] Writing file ${safeFilename} to FFmpeg...`)
                    await ffmpeg.writeFile(safeFilename, await fetchFile(blob))

                    // Verify the file was written successfully
                    const fileExists = await this.verifyFFmpegFile(ffmpeg, safeFilename)
                    if (!fileExists) {
                        throw new Error(`Failed to write file ${safeFilename} to FFmpeg`)
                    }
                    console.log(`[VideoExporter] File ${safeFilename} written successfully.`)

                    // Log file size
                    try {
                        const data = await ffmpeg.readFile(safeFilename)
                        let size = 0
                        if (data instanceof Uint8Array) size = data.length
                        else if (typeof data === 'string') size = data.length
                        console.log(`[VideoExporter] File ${safeFilename} size:`, size, 'bytes')
                    } catch (e) {
                        console.error(`[VideoExporter] Could not read file ${safeFilename} to get size:`, e)
                    }
                } catch (error) {
                    console.error(`[VideoExporter] Failed to process asset ${clip.assetId}:`, error)
                    throw new Error(`Failed to process asset ${clip.assetId}: ${error instanceof Error ? error.message : 'Unknown error'}`)
                }
            }

            // List files after writing inputs
            try {
                const filesAfterInputs = await ffmpeg.listDir('/')
                console.log('[VideoExporter] Files in FFmpeg FS after writing inputs:', filesAfterInputs)
                for (const file of filesAfterInputs) {
                    try {
                        const data = await ffmpeg.readFile(file.name)
                        let size = 0
                        if (data instanceof Uint8Array) size = data.length
                        else if (typeof data === 'string') size = data.length
                        console.log(`[VideoExporter] File ${file.name} size:`, size, 'bytes')
                    } catch (e) {
                        console.error(`[VideoExporter] Could not read file ${file.name} to get size:`, e)
                    }
                }
            } catch (e) {
                console.error('[VideoExporter] Could not list files after writing inputs:', e)
            }

            // Calculate total timeline duration
            const allTimelineEnds = this.clips.map(c => c.timelineEndMs)
            const totalDurationMs = allTimelineEnds.length > 0 ? Math.max(...allTimelineEnds, 2000) : 2000
            const totalDurationSec = Math.ceil(totalDurationMs / 1000)
            console.log('[VideoExporter] totalDurationMs:', totalDurationMs, 'totalDurationSec:', totalDurationSec)

            // Prepare FFmpeg filter inputs and chains
            let filterInputs: string[] = []
            let filterChains: string[] = []
            let inputIndex = 0
            let inputMaps: string[] = []

            // Process media clips
            if (validMediaClips.length > 0) {
                for (let i = 0; i < validMediaClips.length; i++) {
                    const clip = validMediaClips[i]
                    const filename = `input_${i}.${this.getFileExtension(this.assetUrls.get(clip.assetId!) || 'mp4')}`
                    filterInputs.push(`-i`, filename)

                    // Calculate relative start and end times
                    const startTime = clip.timelineStartMs / 1000
                    const endTime = clip.timelineEndMs / 1000
                    const duration = endTime - startTime

                    // Scale and crop first, then trim and adjust timestamps
                    let vf = `scale=-2:1920,crop=1080:1920`
                    let trim = `,trim=start=${startTime}:end=${endTime},setpts=PTS-STARTPTS`

                    // Add timestamp offset for concatenation
                    if (i > 0) {
                        const previousClip = validMediaClips[i - 1]
                        const offset = previousClip.timelineEndMs / 1000
                        trim += `,setpts=PTS+${offset}/TB`
                    }

                    filterChains.push(`[${inputIndex}:v]${vf}${trim}[v${inputIndex}]`)
                    inputMaps.push(`[v${inputIndex}]`)
                    inputIndex++
                }
            } else {
                // Create blank background
                filterInputs.push(
                    '-f', 'lavfi',
                    '-t', `${totalDurationSec}`,
                    '-i', 'color=c=black:s=1080x1920:r=30'
                )
                inputMaps.push('[0:v]')
            }

            // Compose filter_complex - only handle video concatenation
            let filterComplex = ''
            if (inputMaps.length > 0) {
                if (inputMaps.length > 1) {
                    // Multiple videos - concatenate them
                    filterComplex = `${filterChains.join(';')};${inputMaps.join('')}concat=n=${inputMaps.length}:v=1:a=0[outv]`
                } else {
                    // Single video - just pass it through
                    filterComplex = `${filterChains.join(';')};${inputMaps[0]}copy[outv]`
                }
            }

            console.log('[VideoExporter] filterInputs:', filterInputs)
            console.log('[VideoExporter] filterChains:', filterChains)
            console.log('[VideoExporter] inputMaps:', inputMaps)
            console.log('[VideoExporter] filterComplex:', filterComplex)

            // Build FFmpeg command
            const ffmpegArgs = [
                ...filterInputs,
                '-filter_complex', filterComplex,
                '-map', '[outv]',
                '-preset', 'ultrafast',
                '-crf', this.exportType === 'studio' ? '18' : this.exportType === 'social' ? '23' : '28',
                '-c:v', 'h264_nvenc', // Try NVIDIA GPU acceleration first
                '-pix_fmt', 'yuv420p',
                '-movflags', '+faststart',
                '-threads', '0', // Use all available CPU threads
                '-tune', 'fastdecode', // Optimize for fast decoding
                '-y',
                'output.mp4'
            ]

            // Add quick export settings if enabled
            if (this.quickExport) {
                // Reduce resolution for faster processing
                filterComplex = filterComplex.replace('scale=-2:1920', 'scale=-2:960')
                // Use lower quality settings
                ffmpegArgs[ffmpegArgs.indexOf('-crf') + 1] = '35' // Higher CRF = lower quality but faster
                ffmpegArgs[ffmpegArgs.indexOf('-preset') + 1] = 'ultrafast'
                // Reduce frame rate for faster processing
                ffmpegArgs.splice(ffmpegArgs.indexOf('-pix_fmt'), 0, '-r', '24')
            }

            // If NVIDIA encoder fails, try other hardware encoders
            try {
                await ffmpeg.exec(ffmpegArgs)
            } catch (error) {
                console.log('[VideoExporter] NVIDIA encoder failed, trying alternative encoders...')
                // Try Intel QuickSync
                ffmpegArgs[ffmpegArgs.indexOf('-c:v') + 1] = 'h264_qsv'
                try {
                    await ffmpeg.exec(ffmpegArgs)
                } catch (error) {
                    console.log('[VideoExporter] Intel encoder failed, falling back to CPU...')
                    // Fall back to CPU encoding with optimized settings
                    ffmpegArgs[ffmpegArgs.indexOf('-c:v') + 1] = 'libx264'
                    ffmpegArgs[ffmpegArgs.indexOf('-preset') + 1] = 'veryfast'
                    await ffmpeg.exec(ffmpegArgs)
                }
            }

            // List files before running FFmpeg
            try {
                const filesBeforeExec = await ffmpeg.listDir('/')
                console.log('[VideoExporter] Files in FFmpeg FS before exec:', filesBeforeExec)

                // Verify all input files exist
                for (let i = 0; i < validMediaClips.length; i++) {
                    const filename = `input_${i}.${this.getFileExtension(this.assetUrls.get(validMediaClips[i].assetId!) || 'mp4')}`
                    const fileExists = await this.verifyFFmpegFile(ffmpeg, filename)
                    if (!fileExists) {
                        throw new Error(`Input file ${filename} not found in FFmpeg filesystem`)
                    }
                }
            } catch (e) {
                console.error('[VideoExporter] Could not list files before exec:', e)
                throw new Error(`Failed to verify input files: ${e instanceof Error ? e.message : 'Unknown error'}`)
            }

            try {
                console.log('[VideoExporter] Executing FFmpeg command...')
                // Add progress logging
                ffmpeg.on('progress', ({ progress, time }) => {
                    console.log('[VideoExporter] FFmpeg progress:', progress, 'time:', time)
                    if (this.onProgress) {
                        // Convert progress to a percentage (0-100)
                        const progressPercentage = Math.min(Math.round(progress * 100), 100)
                        this.onProgress(progressPercentage)
                    }
                })

                await ffmpeg.exec(ffmpegArgs)
                console.log('[VideoExporter] FFmpeg command completed successfully')

                // Set progress to 100% when complete
                if (this.onProgress) {
                    (this.onProgress as (progress: number) => void)(100)
                }

                // List all files in FFmpeg's filesystem
                const files = await ffmpeg.listDir('/')
                console.log('[VideoExporter] Files in FFmpeg FS after exec:', files)

                // Verify output file exists
                const outputExists = await this.verifyFFmpegFile(ffmpeg, 'output.mp4')
                if (!outputExists) {
                    console.error('[VideoExporter] Output file not found in FFmpeg FS')
                    throw new Error('Output file was not created by FFmpeg')
                }
            } catch (error) {
                console.error('[VideoExporter] FFmpeg execution error:', error)
                // List files in case of error
                try {
                    const files = await ffmpeg.listDir('/')
                    console.log('[VideoExporter] Files in FFmpeg FS after error:', files)
                } catch (listError) {
                    console.error('[VideoExporter] Failed to list FFmpeg files after error:', listError)
                }
                console.error('[VideoExporter] ffmpegArgs on error:', ffmpegArgs)
                console.error('[VideoExporter] filterComplex string on error:', filterComplex)
                throw new Error(`FFmpeg execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
            }

            // Download output
            try {
                console.log('[VideoExporter] Reading output file from FFmpeg memory...')
                const data = await ffmpeg.readFile('output.mp4')
                if (!data) {
                    console.error('[VideoExporter] Output file is empty')
                    throw new Error('Output file is empty')
                }

                // Check if data is a Uint8Array (binary data)
                if (data instanceof Uint8Array) {
                    console.log('[VideoExporter] Output file size:', data.length, 'bytes')
                    if (data.length === 0) {
                        throw new Error('Output file has zero bytes')
                    }
                    if (data.length < 1000) {
                        console.warn('[VideoExporter] Output file seems very small, may be corrupted')
                    }
                } else if (typeof data === 'string') {
                    console.log('[VideoExporter] Output file is a string, length:', data.length)
                    if (data.length === 0) {
                        throw new Error('Output file is empty string')
                    }
                } else {
                    console.error('[VideoExporter] Unexpected data type:', typeof data)
                    throw new Error('Output file has unexpected format')
                }

                console.log('[VideoExporter] Creating in-memory blob from output data...')
                const blob = new Blob([data], { type: 'video/mp4' })
                if (blob.size === 0) {
                    throw new Error('Created blob is empty')
                }
                console.log('[VideoExporter] Blob size:', blob.size, 'bytes')

                console.log('[VideoExporter] Creating temporary download URL...')
                const url = URL.createObjectURL(blob)
                if (!url) {
                    throw new Error('Failed to create object URL')
                }

                console.log('[VideoExporter] Initiating browser download...')
                
                // Enhanced download with better cross-browser support
                const a = document.createElement('a')
                a.href = url
                a.download = `video-export-${Date.now()}.mp4`
                a.style.display = 'none'
                
                // Add to DOM to ensure it works in all browsers
                document.body.appendChild(a)
                
                // Try click
                try {
                    a.click()
                } catch (clickError) {
                    console.warn('[VideoExporter] Click method failed, trying alternative:', clickError)
                    // Alternative method for some browsers
                    const event = new MouseEvent('click', {
                        view: window,
                        bubbles: true,
                        cancelable: true
                    })
                    a.dispatchEvent(event)
                }
                
                // Clean up
                setTimeout(() => {
                    document.body.removeChild(a)
                    URL.revokeObjectURL(url)
                }, 100)
                
                console.log('[VideoExporter] Download initiated successfully - check your browser\'s download folder')
                
                // Verify download was triggered (best effort)
                setTimeout(() => {
                    if (this.onProgress) {
                        this.onProgress(100)
                    }
                }, 500)
                
            } catch (error) {
                console.error('[VideoExporter] Output processing error details:', error)
                if (error instanceof Error) {
                    throw new Error(`Failed to process output file: ${error.message}`)
                }
                throw new Error('Failed to process output file: Unknown error occurred during file processing')
            }
        } catch (error) {
            console.error('[VideoExporter] Export error:', error)
            this.onError(error instanceof Error ? error.message : 'Export failed')
        }
    }

    private async processFallbackExport() {
        try {
            console.log('[VideoExporter] Starting fallback export (no FFmpeg)')
            
            if (this.onProgress) this.onProgress(10)
            
            await this.loadAssetUrls()
            
            if (this.onProgress) this.onProgress(30)
            
            // Create a project bundle with all assets and metadata
            const projectData = {
                exportInfo: {
                    type: 'fallback_export',
                    reason: 'FFmpeg not available - SharedArrayBuffer not supported',
                    exportedAt: new Date().toISOString(),
                    browserInfo: {
                        userAgent: navigator.userAgent,
                        sharedArrayBufferSupported: typeof SharedArrayBuffer !== 'undefined'
                    }
                },
                tracks: this.tracks,
                clips: this.clips,
                assetUrls: Object.fromEntries(this.assetUrls),
                instructions: {
                    message: 'Video processing is not available in this browser. Here are your project assets:',
                    steps: [
                        '1. Download each asset individually using the URLs provided',
                        '2. Use desktop video editing software (like DaVinci Resolve, Premiere Pro, or OpenShot)',
                        '3. Import assets and recreate your timeline using the clip timing data provided',
                        '4. Alternative: Use Chrome or Firefox with HTTPS hosting for browser-based export'
                    ]
                }
            }
            
            if (this.onProgress) this.onProgress(60)
            
            // Create and download project bundle
            const jsonData = JSON.stringify(projectData, null, 2)
            const blob = new Blob([jsonData], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            
            const a = document.createElement('a')
            a.href = url
            a.download = `project-bundle-${Date.now()}.json`
            a.style.display = 'none'
            document.body.appendChild(a)
            a.click()
            
            setTimeout(() => {
                document.body.removeChild(a)
                URL.revokeObjectURL(url)
            }, 100)
            
            if (this.onProgress) this.onProgress(80)
            
            // Also try to download individual assets if possible
            let downloadedAssets = 0
            for (const [assetId, assetUrl] of this.assetUrls.entries()) {
                try {
                    // Create download link for each asset
                    const assetLink = document.createElement('a')
                    assetLink.href = assetUrl
                    assetLink.download = `asset-${assetId}`
                    assetLink.style.display = 'none'
                    document.body.appendChild(assetLink)
                    
                    // Small delay between downloads to avoid overwhelming the browser
                    setTimeout(() => {
                        assetLink.click()
                        document.body.removeChild(assetLink)
                    }, downloadedAssets * 500)
                    
                    downloadedAssets++
                } catch (error) {
                    console.warn(`[VideoExporter] Failed to queue download for asset ${assetId}:`, error)
                }
            }
            
            if (this.onProgress) this.onProgress(100)
            
            console.log(`[VideoExporter] Fallback export complete - downloaded project bundle and ${downloadedAssets} assets`)
            
        } catch (error) {
            console.error('[VideoExporter] Fallback export error:', error)
            throw new Error(`Fallback export failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
    }
} 