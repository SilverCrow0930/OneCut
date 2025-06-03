import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'
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

// Device capability detection
interface DeviceCapabilities {
    hasWebGL: boolean
    hasWebGPU: boolean
    hasSharedArrayBuffer: boolean
    isHighEndDevice: boolean
    memoryAvailable: number
    coreCount: number
}

function detectDeviceCapabilities(): DeviceCapabilities {
    const hasWebGL = !!document.createElement('canvas').getContext('webgl')
    const hasWebGPU = !!(navigator as any).gpu
    const hasSharedArrayBuffer = typeof SharedArrayBuffer !== 'undefined'
    
    // Estimate device performance based on available APIs and hardware
    const memory = (navigator as any).deviceMemory || 4 // Default to 4GB if not available
    const cores = navigator.hardwareConcurrency || 4
    const isHighEndDevice = memory >= 8 && cores >= 8 && hasWebGL
    
    return {
        hasWebGL,
        hasWebGPU,
        hasSharedArrayBuffer,
        isHighEndDevice,
        memoryAvailable: memory,
        coreCount: cores
    }
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
    private exportType: '480p' | '720p' | '1080p'
    private onError: (error: string) => void
    private ffmpeg: FFmpeg | null = null
    private assetUrls: Map<string, string>
    private accessToken?: string | null
    private onProgress: ((progress: number) => void) | undefined
    private quickExport?: boolean
    private optimizationLevel?: 'auto' | 'speed' | 'quality' | 'balanced'
    private allowProgressiveQuality?: boolean

    constructor({ clips, tracks, exportType, onError, accessToken, onProgress, quickExport, optimizationLevel, allowProgressiveQuality }: VideoExporterProps) {
        this.clips = clips
        this.tracks = tracks
        this.exportType = exportType
        this.onError = onError
        this.assetUrls = new Map()
        this.accessToken = accessToken
        this.onProgress = onProgress
        this.quickExport = quickExport
        this.optimizationLevel = optimizationLevel
        this.allowProgressiveQuality = allowProgressiveQuality
    }

    private async initializeFFmpeg() {
        if (this.ffmpeg) return this.ffmpeg
        try {
            this.ffmpeg = new FFmpeg()
            
            console.log('[VideoExporter] Loading FFmpeg.wasm for browser environment...')
            await this.ffmpeg.load()
            console.log('[VideoExporter] FFmpeg.wasm loaded successfully')
            return this.ffmpeg
        } catch (error) {
            console.error('FFmpeg initialization error:', error)
            throw new Error(`Failed to initialize FFmpeg: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
    }

    private async loadAssetUrls() {
        try {
            // Separate external and regular assets
            const allAssets = this.clips.filter(clip => 
                (clip.type === 'video' || clip.type === 'image' || clip.type === 'audio') && clip.assetId
            )
            
            const externalAssets = allAssets.filter(clip => clip.assetId!.startsWith('external_'))
            const regularAssets = allAssets.filter(clip => !clip.assetId!.startsWith('external_'))
            
            console.log('[VideoExporter] Found assets:', {
                total: allAssets.length,
                external: externalAssets.length,
                regular: regularAssets.length
            })

            this.assetUrls = new Map()

            // Handle external assets - get URLs from clip properties
            externalAssets.forEach(clip => {
                const externalAsset = clip.properties?.externalAsset
                if (externalAsset && externalAsset.url) {
                    this.assetUrls.set(clip.assetId!, externalAsset.url)
                    console.log(`[VideoExporter] Using embedded URL for external asset: ${clip.assetId}`)
                } else {
                    console.error(`[VideoExporter] External asset ${clip.assetId} missing URL in properties:`, clip.properties)
                }
            })

            // Handle regular assets - fetch URLs from API
            if (regularAssets.length > 0) {
                const regularAssetIds = regularAssets.map(clip => clip.assetId!)
                console.log('[VideoExporter] Loading regular asset URLs for IDs:', regularAssetIds)
                
                const regularAssetUrls = await fetchAssetUrls(regularAssetIds, this.accessToken)
                
                // Merge regular asset URLs with external asset URLs
                regularAssetUrls.forEach((url, id) => {
                    this.assetUrls.set(id, url)
                })
            }

            if (this.assetUrls.size === 0) {
                throw new Error('No asset URLs available. Check if assets exist and external assets have valid URLs.')
            }

            // Log successful and failed asset loads
            const successfulAssets = Array.from(this.assetUrls.keys())
            const allAssetIds = allAssets.map(clip => clip.assetId!)
            const failedAssets = allAssetIds.filter(id => !this.assetUrls.has(id))
            
            if (successfulAssets.length > 0) {
                console.log('[VideoExporter] Successfully loaded asset URLs:', successfulAssets)
            }
            if (failedAssets.length > 0) {
                console.error('[VideoExporter] Failed to load asset URLs:', failedAssets)
                throw new Error(`Failed to load ${failedAssets.length} asset(s): ${failedAssets.join(', ')}. These assets may not exist or have invalid URLs.`)
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

            console.log('[VideoExporter] tracks:', this.tracks)
            console.log('[VideoExporter] clips:', this.clips)

            if (!Array.isArray(this.tracks) || !Array.isArray(this.clips)) {
                throw new Error('VideoExporter: tracks or clips is not an array')
            }

            // Always try to initialize FFmpeg first
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
                    // Skip directory entries like "." and ".."
                    if (file.name === '.' || file.name === '..' || file.isDir) {
                        continue
                    }
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

            // Process media clips with optimized approach  
            if (validMediaClips.length > 0) {
                for (let i = 0; i < validMediaClips.length; i++) {
                    const clip = validMediaClips[i]
                    const filename = `input_${i}.${this.getFileExtension(this.assetUrls.get(clip.assetId!) || 'mp4')}`
                    filterInputs.push(`-i`, filename)

                    // Scale to match the selected resolution
                    const targetResolution = this.exportType === '480p' ? '480:854' : this.exportType === '720p' ? '720:1280' : '1080:1920'
                    console.log(`[VideoExporter] Using resolution: ${this.exportType} -> ${targetResolution}`)
                    
                    // For single video, output directly to [outv]. For multiple videos, use intermediate labels
                    const outputLabel = validMediaClips.length === 1 ? 'outv' : `v${inputIndex}`
                    let vf = `scale=${targetResolution}:force_original_aspect_ratio=decrease:flags=fast_bilinear,pad=${targetResolution}:(ow-iw)/2:(oh-ih)/2:black`
                    
                    filterChains.push(`[${inputIndex}:v]${vf}[${outputLabel}]`)
                    if (validMediaClips.length > 1) {
                        inputMaps.push(`[v${inputIndex}]`)
                    }
                    inputIndex++
                }
            } else {
                // Create blank background with selected resolution
                const backgroundSize = this.exportType === '480p' ? '480x854' : this.exportType === '720p' ? '720x1280' : '1080x1920'
                console.log(`[VideoExporter] Using background resolution: ${this.exportType} -> ${backgroundSize}`)
                filterInputs.push(
                    '-f', 'lavfi',
                    '-t', `${totalDurationSec}`,
                    '-i', `color=c=black:s=${backgroundSize}:r=30`
                )
                // For blank background, no filter needed, just map directly
                filterChains = []
                inputMaps = []
            }

            // Compose filter_complex - simplified concatenation
            let filterComplex = ''
            if (validMediaClips.length === 1) {
                // Single video - filter chain already outputs to [outv]
                filterComplex = filterChains.join('')
            } else if (validMediaClips.length > 1) {
                // Multiple videos - concatenate them
                filterComplex = `${filterChains.join(';')};${inputMaps.join('')}concat=n=${inputMaps.length}:v=1:a=0[outv]`
            } else {
                // No clips, just use the blank background directly
                filterComplex = ''
            }

            console.log('[VideoExporter] filterInputs:', filterInputs)
            console.log('[VideoExporter] filterChains:', filterChains)
            console.log('[VideoExporter] inputMaps:', inputMaps)
            console.log('[VideoExporter] filterComplex:', filterComplex)
            console.log(`[VideoExporter] Export settings: type=${this.exportType}, quickExport=${this.quickExport}`)

            // Build optimized FFmpeg command for browser (software encoding only)
            let ffmpegArgs = []
            
            if (filterComplex) {
                // Use filter complex for video processing
                ffmpegArgs = [
                    ...filterInputs,
                    '-filter_complex', filterComplex,
                    '-map', '[outv]',
                    '-c:v', 'libx264',
                    '-preset', 'medium',
                    '-crf', this.exportType === '480p' ? '28' : this.exportType === '720p' ? '25' : '23',
                    '-pix_fmt', 'yuv420p',
                    '-r', '30',
                    '-s', this.exportType === '480p' ? '480x854' : this.exportType === '720p' ? '720x1280' : '1080x1920',
                    '-movflags', '+faststart',
                    '-y',
                    'output.mp4'
                ]
            } else {
                // Direct mapping for blank background (no filter needed)
                ffmpegArgs = [
                    ...filterInputs,
                    '-c:v', 'libx264',
                    '-preset', 'medium', 
                    '-crf', this.exportType === '480p' ? '28' : this.exportType === '720p' ? '25' : '23',
                    '-pix_fmt', 'yuv420p',
                    '-r', '30',
                    '-s', this.exportType === '480p' ? '480x854' : this.exportType === '720p' ? '720x1280' : '1080x1920',
                    '-movflags', '+faststart',
                    '-y',
                    'output.mp4'
                ]
            }

            // Quick export mode - use ultrafast preset but keep it simple
            if (this.quickExport) {
                if (filterComplex) {
                    ffmpegArgs = [
                        ...filterInputs,
                        '-filter_complex', filterComplex,
                        '-map', '[outv]',
                        '-c:v', 'libx264',
                        '-preset', 'ultrafast',
                        '-crf', '30',
                        '-pix_fmt', 'yuv420p',
                        '-r', '30',
                        '-s', this.exportType === '480p' ? '480x854' : this.exportType === '720p' ? '720x1280' : '1080x1920',
                        '-movflags', '+faststart',
                        '-y',
                        'output.mp4'
                    ]
                } else {
                    ffmpegArgs = [
                        ...filterInputs,
                        '-c:v', 'libx264',
                        '-preset', 'ultrafast',
                        '-crf', '30',
                        '-pix_fmt', 'yuv420p',
                        '-r', '30',
                        '-s', this.exportType === '480p' ? '480x854' : this.exportType === '720p' ? '720x1280' : '1080x1920',
                        '-movflags', '+faststart',
                        '-y',
                        'output.mp4'
                    ]
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
                console.log('[VideoExporter] Executing FFmpeg command in browser environment...')
                console.log('[VideoExporter] Command:', ffmpegArgs.join(' '))
                
                // Add progress logging optimized for web
                ffmpeg.on('progress', ({ progress, time }) => {
                    const timeSeconds = time / 1000000; // Convert microseconds to seconds
                    console.log(`[VideoExporter] Progress: ${(progress * 100).toFixed(1)}% | Time: ${timeSeconds.toFixed(1)}s`)
                    if (this.onProgress) {
                        const progressPercentage = Math.min(Math.round(progress * 100), 100)
                        this.onProgress(progressPercentage)
                    }
                })

                // Add log handling for browser debugging
                ffmpeg.on('log', ({ type, message }) => {
                    if (type === 'stderr') {
                        // Only log important messages to avoid console spam
                        if (message.includes('frame=') && message.includes('fps=')) {
                            console.log('[VideoExporter] Processing:', message.trim())
                        } else if (message.includes('error') || message.includes('Error') || message.includes('failed')) {
                            console.error('[VideoExporter] FFmpeg Error:', message)
                        }
                    }
                })
                
                console.log('[VideoExporter] Starting browser-optimized encoding...')
                await ffmpeg.exec(ffmpegArgs)
                console.log('[VideoExporter] Browser encoding completed successfully')

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
                    
                    // List files again for debugging
                    const debugFiles = await ffmpeg.listDir('/')
                    console.error('[VideoExporter] Available files:', debugFiles.map(f => f.name))
                    
                    throw new Error('Output file was not created by FFmpeg')
                }
            } catch (error) {
                console.error('[VideoExporter] FFmpeg execution error:', error)
                // List files in case of error
                try {
                    const files = await ffmpeg.listDir('/')
                    console.log('[VideoExporter] Files in FFmpeg FS after error:', files)
                    
                    // Try to read FFmpeg logs if available
                    try {
                        const logFiles = files.filter(f => 
                            !f.isDir && // Only include files, not directories
                            f.name !== '.' && f.name !== '..' && // Skip directory references
                            (f.name.includes('log') || f.name.includes('err'))
                        )
                        for (const logFile of logFiles) {
                            try {
                                const logContent = await ffmpeg.readFile(logFile.name)
                                console.log(`[VideoExporter] Log file ${logFile.name}:`, 
                                    typeof logContent === 'string' ? logContent : new TextDecoder().decode(logContent as Uint8Array))
                            } catch (e) {
                                console.warn(`[VideoExporter] Could not read log file ${logFile.name}:`, e)
                            }
                        }
                    } catch (e) {
                        console.warn('[VideoExporter] Could not read log files:', e)
                    }
                } catch (listError) {
                    console.error('[VideoExporter] Failed to list FFmpeg files after error:', listError)
                }
                
                console.error('[VideoExporter] ffmpegArgs on error:', ffmpegArgs)
                console.error('[VideoExporter] filterComplex string on error:', filterComplex)
                
                // Provide more specific error message
                const errorMessage = error instanceof Error ? error.message : 'Unknown error'
                if (errorMessage.includes('Invalid argument') || errorMessage.includes('filter')) {
                    throw new Error(`FFmpeg filter error: Invalid video filter configuration. This might be due to incompatible video formats or timing issues.`)
                } else if (errorMessage.includes('No such file')) {
                    throw new Error(`FFmpeg input error: Could not find input files. Check if assets were loaded correctly.`)
                } else {
                    throw new Error(`FFmpeg execution failed: ${errorMessage}`)
                }
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
                a.download = `video-export-${this.exportType}-${Date.now()}.mp4`
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
} 