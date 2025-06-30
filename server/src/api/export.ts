/**
 * CONSOLIDATED EXPORT SYSTEM
 * 
 * This file contains the complete server-side video export implementation:
 * - Handles text, captions, video, audio, and image elements
 * - Includes font management for proper text rendering
 * - Supports complex timeline compositions with overlays and transitions
 * - Refactored to remove duplications and fix TypeScript errors
 * 
 * Key Features:
 * - Professional video export with FFmpeg
 * - Text and caption rendering with system fonts
 * - Asset downloading and management
 * - Progress tracking and job management
 * - Multiple audio track mixing
 * - Video overlay composition with timing
 */

import express from 'express'
import { body, validationResult } from 'express-validator'
import ffmpeg from 'fluent-ffmpeg'
import { v4 as uuid } from 'uuid'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import cron from 'node-cron'
import { Request, Response } from 'express'
import { supabase } from '../config/supabaseClient.js'
import { bucket } from '../integrations/googleStorage.js'

// Configure FFmpeg path
const isProduction = process.env.NODE_ENV === 'production'
const ffmpegPath = process.env.FFMPEG_PATH || (isProduction ? 'ffmpeg' : 'C:\\ffmpeg\\bin\\ffmpeg.exe')
const ffprobePath = process.env.FFPROBE_PATH || (isProduction ? 'ffprobe' : 'C:\\ffmpeg\\bin\\ffprobe.exe')

try {
    ffmpeg.setFfmpegPath(ffmpegPath)
    ffmpeg.setFfprobePath(ffprobePath)
    console.log(`[FFmpeg] Set FFmpeg path to: ${ffmpegPath}`)
    console.log(`[FFmpeg] Set FFprobe path to: ${ffprobePath}`)
} catch (error) {
    console.error('[FFmpeg] Failed to set FFmpeg paths:', error)
}

const router = express.Router()

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Create temp directories
const TEMP_DIR = path.join(__dirname, '../../temp')
const EXPORTS_DIR = path.join(TEMP_DIR, 'exports')

async function ensureDirectories() {
    try {
        await fs.mkdir(TEMP_DIR, { recursive: true })
        await fs.mkdir(EXPORTS_DIR, { recursive: true })
    } catch (error) {
        console.error('Failed to create temp directories:', error)
    }
}

ensureDirectories()

// Professional Timeline Interfaces
interface TimelineElement {
    id: string
    type: 'video' | 'audio' | 'image' | 'gif' | 'text' | 'caption'
    trackId: string
    timelineStartMs: number
    timelineEndMs: number
    sourceStartMs?: number
    sourceEndMs?: number
    assetId?: string
    speed?: number
    volume?: number
    opacity?: number
    text?: string
    fontSize?: number
    fontColor?: string
    fontFamily?: string
    fontWeight?: string
    fontStyle?: string
    textAlign?: string
    backgroundColor?: string
    borderColor?: string
    borderWidth?: number
    position?: { x: number, y: number }
    transitionIn?: { type: string, duration: number }
    transitionOut?: { type: string, duration: number }
    properties?: {
        externalAsset?: { url: string, platform: string }
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

interface ExportJob {
    id: string
    status: 'queued' | 'processing' | 'completed' | 'failed'
    progress: number
    error?: string
    outputPath?: string
    downloadUrl?: string
    createdAt: Date
    completedAt?: Date
    exportSettings: ExportSettings
}

interface ExportSettings {
    resolution: '480p' | '720p' | '1080p'
    fps: number
    quality: 'low' | 'medium' | 'high'
    quickExport?: boolean
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
    volume?: number
    properties?: {
        externalAsset?: { url: string, platform: string }
        text?: string
        fontSize?: number
        fontColor?: string
        position?: { x: number, y: number }
        [key: string]: any
    }
}

interface TimelineTrack {
    id: string
    index: number
    type: 'video' | 'audio' | 'image' | 'text'
    name: string
}

const exportJobs = new Map<string, ExportJob>()

// Cleanup old exports
cron.schedule('0 * * * *', () => cleanupOldExports())

async function cleanupOldExports() {
    try {
        const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000)
        for (const [jobId, job] of exportJobs.entries()) {
            if (job.createdAt < cutoffTime) {
                if (job.outputPath) {
                    try { await fs.unlink(job.outputPath) } catch {}
                }
                exportJobs.delete(jobId)
            }
        }
    } catch (error) {
        console.error('Cleanup error:', error)
    }
}

const validateExportRequest = [
    body('clips').isArray(),
    body('tracks').isArray(),
    body('exportSettings.resolution').isIn(['480p', '720p', '1080p']),
    body('exportSettings.quality').isIn(['low', 'medium', 'high']),
    body('exportSettings.fps').isInt({ min: 24, max: 60 })
]

async function fetchAssetUrl(assetId: string): Promise<string> {
    console.log(`[Asset] Fetching URL for asset: ${assetId}`)
    
    try {
    const { data: asset, error } = await supabase
        .from('assets')
        .select('object_key')
        .eq('id', assetId)
        .single()

        if (error) {
            console.error(`[Asset] Database error for ${assetId}:`, error)
            throw new Error(`Database error for asset ${assetId}: ${error.message}`)
        }

        if (!asset) {
            console.error(`[Asset] Asset not found: ${assetId}`)
            throw new Error(`Asset ${assetId} not found in database`)
        }

        console.log(`[Asset] Found asset ${assetId}, object_key: ${asset.object_key}`)

    const [url] = await bucket.file(asset.object_key).getSignedUrl({
        action: 'read',
        expires: Date.now() + 60 * 60 * 1000
    })
    
        console.log(`[Asset] Generated signed URL for ${assetId}`)
    return url
        
    } catch (error) {
        console.error(`[Asset] Failed to fetch URL for ${assetId}:`, error)
        throw error
    }
}

/**
 * Enhanced asset download with retry mechanism and better error handling
 */
async function downloadAsset(url: string, filename: string, maxRetries: number = 3): Promise<string> {
    console.log(`[Download] Starting download: ${filename}`)
    console.log(`[Download] URL: ${url.substring(0, 100)}...`)
    
    let lastError: Error | null = null
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(`[Download] Attempt ${attempt}/${maxRetries} for ${filename}`)
    
    // Add timeout to prevent hanging
    const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 45000) // 45 second timeout
        
        try {
            // Validate URL before attempting download
            let parsedUrl: URL
            try {
                parsedUrl = new URL(url)
            } catch {
                throw new Error(`Invalid URL format: ${url}`)
            }
            
            // Check for common issues
            if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
                throw new Error(`Unsupported protocol: ${parsedUrl.protocol}`)
            }
            
        const response = await fetch(url, { 
            signal: controller.signal,
            headers: {
                    'User-Agent': 'Lemona-Server/1.0',
                    'Accept': '*/*',
                    'Cache-Control': 'no-cache'
            }
        })
        
        clearTimeout(timeoutId)
        
    if (!response.ok) {
                const errorMsg = `HTTP ${response.status}: ${response.statusText}`
                
                // Don't retry on client errors (4xx)
                if (response.status >= 400 && response.status < 500) {
                    throw new Error(`${errorMsg} (client error - not retrying)`)
                }
                
                throw new Error(errorMsg)
            }
            
            const contentLength = response.headers.get('content-length')
            const contentType = response.headers.get('content-type')
            
            console.log(`[Download] Response OK for ${filename}`)
            console.log(`[Download] Content-Type: ${contentType || 'unknown'}`)
            console.log(`[Download] Content-Length: ${contentLength || 'unknown'} bytes`)
            
            // Validate content type for media files
            if (contentType && !contentType.startsWith('video/') && 
                !contentType.startsWith('audio/') && 
                !contentType.startsWith('image/') &&
                !contentType.startsWith('application/')) {
                console.warn(`[Download] Unexpected content type: ${contentType}`)
            }
    
    const buffer = await response.arrayBuffer()
            
            // Validate file size
            if (buffer.byteLength === 0) {
                throw new Error('Downloaded file is empty')
            }
            
            if (buffer.byteLength > 500 * 1024 * 1024) { // 500MB limit
                throw new Error(`File too large: ${buffer.byteLength} bytes (500MB limit)`)
            }
            
    const filePath = path.join(TEMP_DIR, filename)
    await fs.writeFile(filePath, Buffer.from(buffer))
        
            // Verify file was written successfully
            try {
                const stats = await fs.stat(filePath)
                if (stats.size !== buffer.byteLength) {
                    throw new Error('File size mismatch after writing')
                }
            } catch (statError) {
                throw new Error(`Failed to verify downloaded file: ${statError instanceof Error ? statError.message : 'Unknown error'}`)
            }
            
            console.log(`[Download] Successfully saved ${filename} (${buffer.byteLength} bytes) to ${filePath}`)
    return filePath
        
    } catch (error) {
        clearTimeout(timeoutId)
            lastError = error instanceof Error ? error : new Error('Unknown download error')
            
            console.error(`[Download] Attempt ${attempt} failed for ${filename}:`, lastError.message)
            
            // Don't retry on certain errors
            if (lastError.message.includes('client error - not retrying') ||
                lastError.message.includes('Invalid URL format') ||
                lastError.message.includes('Unsupported protocol') ||
                lastError.message.includes('File too large')) {
                break
            }
            
            if (lastError.name === 'AbortError') {
                lastError = new Error(`Download timeout after 45 seconds for ${filename}`)
                console.error(`[Download] Timeout on attempt ${attempt}`)
            }
            
            // Wait before retry (exponential backoff)
            if (attempt < maxRetries) {
                const waitMs = Math.min(1000 * Math.pow(2, attempt - 1), 10000) // Max 10s wait
                console.log(`[Download] Waiting ${waitMs}ms before retry...`)
                await new Promise(resolve => setTimeout(resolve, waitMs))
            }
        }
    }
    
    const finalError = lastError || new Error('Download failed for unknown reason')
    console.error(`[Download] All ${maxRetries} attempts failed for ${filename}`)
    throw new Error(`Download failed after ${maxRetries} attempts: ${finalError.message}`)
}

// Duration validation constants
const MIN_DURATION_MS = 100 // Minimum 100ms (0.1 seconds)
const MIN_DURATION_SEC = MIN_DURATION_MS / 1000
const MAX_DURATION_MS = 3600000 // Maximum 1 hour (3600 seconds)
const MAX_TIMELINE_ELEMENTS = 1000 // Maximum elements per timeline
const MAX_TRACKS = 100 // Maximum tracks per project

/**
 * Validates and fixes timeline durations to prevent FFmpeg errors
 */
function validateDuration(startMs: number, endMs: number, elementType: string, elementId: string): { startMs: number, endMs: number, durationMs: number } {
    let validatedStartMs = Math.max(0, startMs || 0)
    let validatedEndMs = Math.max(validatedStartMs + MIN_DURATION_MS, endMs || MIN_DURATION_MS)
    
    const durationMs = validatedEndMs - validatedStartMs
    
    if (durationMs < MIN_DURATION_MS) {
        console.warn(`[Duration Validation] ${elementType} ${elementId}: Duration ${durationMs}ms too short, extending to ${MIN_DURATION_MS}ms`)
        validatedEndMs = validatedStartMs + MIN_DURATION_MS
    }
    
    return {
        startMs: validatedStartMs,
        endMs: validatedEndMs,
        durationMs: validatedEndMs - validatedStartMs
    }
}

/**
 * Validates source trimming to ensure positive durations
 */
function validateSourceTrimming(sourceStartMs?: number, sourceEndMs?: number): { sourceStartMs?: number, sourceEndMs?: number, sourceDurationMs?: number } {
    if (sourceStartMs !== undefined && sourceEndMs !== undefined) {
        const validatedStart = Math.max(0, sourceStartMs)
        const validatedEnd = Math.max(validatedStart + MIN_DURATION_MS, sourceEndMs)
        
        return {
            sourceStartMs: validatedStart,
            sourceEndMs: validatedEnd,
            sourceDurationMs: validatedEnd - validatedStart
        }
    }
    
    return { sourceStartMs, sourceEndMs }
}

function convertToTimelineElements(clips: TimelineClip[]): TimelineElement[] {
    return clips.map(clip => {
        // Validate timeline duration
        const { startMs, endMs } = validateDuration(
            clip.timelineStartMs, 
            clip.timelineEndMs, 
            clip.type, 
            clip.id
        )
        
        // Validate source trimming if present
        const { sourceStartMs, sourceEndMs } = validateSourceTrimming(
            clip.sourceStartMs,
            clip.sourceEndMs
        )
        
        return {
        id: clip.id,
        type: clip.type as any,
        trackId: clip.trackId,
            timelineStartMs: startMs,
            timelineEndMs: endMs,
            sourceStartMs,
            sourceEndMs,
        assetId: clip.assetId,
        speed: clip.speed,
        volume: clip.volume,
        text: clip.properties?.text,
        fontSize: clip.properties?.fontSize,
        fontColor: clip.properties?.fontColor,
        position: clip.properties?.position,
        properties: clip.properties
        }
    })
}

class ProfessionalVideoExporter {
    private elements: TimelineElement[]
    private tracks: TimelineTrack[]
    private totalDurationMs: number
    private outputSettings: { width: number, height: number, fps: number }
    private downloadedAssets: Map<string, string>
    private jobId: string

    constructor(elements: TimelineElement[], tracks: TimelineTrack[], outputSettings: any, downloadedAssets: Map<string, string>, jobId: string) {
        this.elements = elements.sort((a, b) => a.timelineStartMs - b.timelineStartMs)
        this.tracks = tracks.sort((a, b) => a.index - b.index)
        
        // Calculate and validate total duration
        const calculatedDuration = elements.length > 0 
            ? Math.max(...elements.map(e => e.timelineEndMs)) 
            : MIN_DURATION_MS
        
        // Ensure minimum total duration (1 second minimum for background video)
        this.totalDurationMs = Math.max(calculatedDuration, 1000)
        
        console.log(`[Export ${jobId}] Timeline duration calculated: ${this.totalDurationMs}ms (${this.totalDurationMs / 1000}s)`)
        
        this.outputSettings = outputSettings
        this.downloadedAssets = downloadedAssets
        this.jobId = jobId
    }

    async exportVideo(outputPath: string): Promise<void> {
        const ffmpegCommand = ffmpeg()
        
        console.log(`[Export ${this.jobId}] Professional export: ${this.elements.length} elements, ${this.tracks.length} tracks`)
        
        await this.addInputAssets(ffmpegCommand)
        const filterGraph = await this.buildFilterGraph()
        
        console.log(`[Export ${this.jobId}] Filter: ${filterGraph}`)
        
        // Use addOption instead of complexFilter to avoid fluent-ffmpeg issues
        ffmpegCommand
            .addOption('-filter_complex', filterGraph)
            .addOption('-map', '[final_video]')
            .addOption('-map', '[final_audio]')
            .addOption('-c:v', 'libx264')
            .addOption('-c:a', 'aac')
            .addOption('-preset', 'medium')
            .addOption('-crf', '23')
            .addOption('-pix_fmt', 'yuv420p')
            .addOption('-movflags', '+faststart')
            .output(outputPath)
        
        return new Promise((resolve, reject) => {
            let ffmpegStarted = false
            let lastProgress = 0
            
            ffmpegCommand
                .on('start', (commandLine) => {
                    ffmpegStarted = true
                    console.log(`[Export ${this.jobId}] FFmpeg started successfully`)
                    console.log(`[Export ${this.jobId}] Command: ${commandLine.length > 500 ? commandLine.substring(0, 500) + '...' : commandLine}`)
                })
                .on('progress', (progress) => {
                    // Log progress every 10% or significant change
                    const currentProgress = Math.round(progress.percent || 0)
                    if (currentProgress - lastProgress >= 10 || currentProgress === 100) {
                        console.log(`[Export ${this.jobId}] FFmpeg progress: ${currentProgress}% (${progress.timemark || 'unknown'})`)
                        lastProgress = currentProgress
                    }
                })
                .on('end', () => {
                    console.log(`[Export ${this.jobId}] FFmpeg export completed successfully`)
                    resolve()
                })
                .on('error', (err: any, stdout: string | null, stderr: string | null) => {
                    console.error(`[Export ${this.jobId}] FFmpeg error occurred`)
                    console.error(`[Export ${this.jobId}] Error message: ${err.message}`)
                    
                    // Enhanced error analysis
                    let errorCategory = 'Unknown'
                    let userFriendlyMessage = 'Video export failed due to an unknown error'
                    
                    if (stderr) {
                        console.error(`[Export ${this.jobId}] FFmpeg stderr:`, stderr)
                        
                        // Analyze common FFmpeg errors
                        if (stderr.includes('Invalid data found when processing input')) {
                            errorCategory = 'Corrupted Input'
                            userFriendlyMessage = 'One or more input files are corrupted or invalid'
                        } else if (stderr.includes('No such file or directory')) {
                            errorCategory = 'Missing File'
                            userFriendlyMessage = 'One or more required files could not be found'
                        } else if (stderr.includes('Permission denied')) {
                            errorCategory = 'Permission Error'
                            userFriendlyMessage = 'Permission denied accessing files or directories'
                        } else if (stderr.includes('codec not currently supported')) {
                            errorCategory = 'Unsupported Codec'
                            userFriendlyMessage = 'Video contains unsupported codec or format'
                        } else if (stderr.includes('Error initializing complex filters')) {
                            errorCategory = 'Filter Error'
                            userFriendlyMessage = 'Video processing filter configuration error'
                        } else if (stderr.includes('Conversion failed')) {
                            errorCategory = 'Conversion Error'
                            userFriendlyMessage = 'Video conversion process failed'
                        } else if (stderr.includes('No space left on device')) {
                            errorCategory = 'Storage Full'
                            userFriendlyMessage = 'Not enough storage space to complete export'
                        } else if (stderr.includes('Killed')) {
                            errorCategory = 'Out of Memory'
                            userFriendlyMessage = 'Export failed due to insufficient memory'
                        } else if (stderr.includes('Invalid argument')) {
                            errorCategory = 'Invalid Parameters'
                            userFriendlyMessage = 'Invalid export parameters provided'
                        }
                    }
                    
                    if (stdout) {
                        console.log(`[Export ${this.jobId}] FFmpeg stdout:`, stdout)
                    }
                    
                    // Check if FFmpeg even started
                    if (!ffmpegStarted) {
                        errorCategory = 'Startup Failure'
                        userFriendlyMessage = 'FFmpeg failed to start - check installation and configuration'
                    }
                    
                    console.error(`[Export ${this.jobId}] Error category: ${errorCategory}`)
                    
                    // Create enhanced error object
                    const enhancedError = new Error(`${userFriendlyMessage} (${errorCategory})`)
                    ;(enhancedError as any).category = errorCategory
                    ;(enhancedError as any).originalError = err
                    ;(enhancedError as any).stderr = stderr
                    ;(enhancedError as any).stdout = stdout
                    
                    reject(enhancedError)
                })
                .run()
        })
    }

    private async addInputAssets(command: ffmpeg.FfmpegCommand): Promise<void> {
        const mediaElements = this.elements.filter(e => 
            ['video', 'audio', 'image', 'gif'].includes(e.type) && e.assetId && this.downloadedAssets.has(e.assetId)
        )

        const uniqueAssets = [...new Set(mediaElements.map(e => this.downloadedAssets.get(e.assetId!)!))]
        
        console.log(`[Export ${this.jobId}] Adding ${uniqueAssets.length} unique assets as inputs`)
        uniqueAssets.forEach((assetPath, index) => {
            console.log(`[Export ${this.jobId}] Input ${index}: ${assetPath}`)
            command.input(assetPath)
        })

        // Black background at the end
        const backgroundIndex = uniqueAssets.length
        console.log(`[Export ${this.jobId}] Adding black background as input ${backgroundIndex}`)
        command.input(`color=c=black:s=${this.outputSettings.width}x${this.outputSettings.height}:r=${this.outputSettings.fps}`)
               .inputFormat('lavfi')
               .duration(this.totalDurationMs / 1000)
    }

    private async buildFilterGraph(): Promise<string> {
        const filters: string[] = []
        const inputMapping = this.createInputMapping()
        
        console.log(`[Export ${this.jobId}] Building professional timeline-based filter graph`)
        console.log(`[Export ${this.jobId}] Timeline duration: ${this.totalDurationMs}ms`)
        
        // Validate timeline duration
        const timelineDurationSec = Math.max(this.totalDurationMs / 1000, 1)
        const backgroundIndex = inputMapping.size
        
        // Step 1: Create master timeline background
        filters.push(`[${backgroundIndex}:v]trim=duration=${timelineDurationSec},setpts=PTS-STARTPTS,scale=${this.outputSettings.width}:${this.outputSettings.height}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${this.outputSettings.width}:${this.outputSettings.height}:(ow-iw)/2:(oh-ih)/2:black,format=yuv420p,fps=${this.outputSettings.fps}[master_timeline]`)
        
        // Step 2: Process video elements
        const videoTracks = this.buildVideoTracks(filters, inputMapping, timelineDurationSec)
        
        // Step 3: Process audio elements
        const audioTracks = this.buildAudioTracks(filters, inputMapping, timelineDurationSec)
        
        // Step 4: Composite video tracks
        const finalVideo = this.compositeVideoTracks(filters, videoTracks, 'master_timeline')
        
        // Step 5: Add text and caption overlays (UPDATED)
        this.addTextAndCaptionOverlays(filters, finalVideo)
        
        // Step 6: Mix audio tracks
        this.mixAudioTracks(filters, audioTracks)
        
        console.log(`[Export ${this.jobId}] Professional filter graph built with ${filters.length} filter operations`)
        return filters.join(';')
    }

    private buildVideoTracks(filters: string[], inputMapping: Map<string, number>, timelineDuration: number): Array<{label: string, startTime: number, endTime: number}> {
        const videoTracks: Array<{label: string, startTime: number, endTime: number}> = []
        
        const videoElements = this.elements
            .filter(e => ['video', 'image', 'gif'].includes(e.type) && e.assetId && this.downloadedAssets.has(e.assetId))
                .sort((a, b) => a.timelineStartMs - b.timelineStartMs)

        console.log(`[Export ${this.jobId}] Building ${videoElements.length} video tracks`)

        videoElements.forEach((element, index) => {
                const assetPath = this.downloadedAssets.get(element.assetId!)
                const inputIndex = inputMapping.get(assetPath!)
                if (inputIndex === undefined) return

            const trackLabel = `video_track_${index}`
            
            // Validate timeline positions with minimum duration
            const startTime = Math.max(0, element.timelineStartMs / 1000)
            const endTime = Math.max(startTime + MIN_DURATION_SEC, element.timelineEndMs / 1000)
            const duration = endTime - startTime
            
            // Additional validation - skip if still invalid
            if (duration < MIN_DURATION_SEC) {
                console.warn(`[Export ${this.jobId}] Skipping invalid video track ${index}: ${startTime}s-${endTime}s (duration: ${duration}s, minimum: ${MIN_DURATION_SEC}s)`)
                return
            }
            
            // Build element processing filter
            let elementFilter = `[${inputIndex}:v]`
        
        // Source trimming with validation
        if (element.sourceStartMs !== undefined && element.sourceEndMs !== undefined) {
                const sourceStart = Math.max(0, element.sourceStartMs / 1000)
                const sourceEnd = Math.max(sourceStart + MIN_DURATION_SEC, element.sourceEndMs / 1000)
                const sourceDuration = sourceEnd - sourceStart
                
                // Only add source trimming if duration is valid
                if (sourceDuration >= MIN_DURATION_SEC) {
                elementFilter += `trim=start=${sourceStart}:duration=${sourceDuration},setpts=PTS-STARTPTS,`
                    console.log(`[Export ${this.jobId}] Video track ${index}: Source trimming ${sourceStart}s-${sourceEnd}s (${sourceDuration}s)`)
                } else {
                    console.warn(`[Export ${this.jobId}] Video track ${index}: Source trimming duration too short (${sourceDuration}s), skipping trim`)
                }
        }
        
        // Speed adjustment
        if (element.speed && element.speed !== 1) {
                elementFilter += `setpts=${1/element.speed}*PTS,`
        }
        
            // Image duration handling
        if (element.type === 'image') {
                elementFilter += `loop=loop=-1:size=1:start=0,setpts=N/(${this.outputSettings.fps}*TB),`
            }
            
            // Professional scaling and formatting
            elementFilter += `scale=${this.outputSettings.width}:${this.outputSettings.height}:force_original_aspect_ratio=decrease:flags=lanczos,`
            elementFilter += `pad=${this.outputSettings.width}:${this.outputSettings.height}:(ow-iw)/2:(oh-ih)/2:black,`
            elementFilter += `format=yuv420p,fps=${this.outputSettings.fps}`
            
            // Effects
        if (element.opacity && element.opacity !== 1) {
                elementFilter += `,colorchannelmixer=aa=${element.opacity}`
        }
        
        // Transitions with duration validation
        if (element.transitionIn) {
                const transitionDuration = Math.min(element.transitionIn.duration || 0.5, duration / 2)
                if (transitionDuration > 0) {
                elementFilter += `,fade=t=in:st=0:d=${transitionDuration}`
                }
        }
        
        if (element.transitionOut) {
                const transitionDuration = Math.min(element.transitionOut.duration || 0.5, duration / 2)
                const transitionStart = Math.max(0, duration - transitionDuration)
                if (transitionDuration > 0) {
                elementFilter += `,fade=t=out:st=${transitionStart}:d=${transitionDuration}`
                }
            }
            
            // Final duration trim and timing setup for overlay positioning
            const hasSourceTrimming = element.sourceStartMs !== undefined && element.sourceEndMs !== undefined
            const isImageWithLoop = element.type === 'image'
            
            if (!hasSourceTrimming && !isImageWithLoop) {
                elementFilter += `,trim=duration=${duration},setpts=PTS-STARTPTS`
            }
            
            // Add delay for timeline positioning (this replaces the overlay enable parameter)
            if (startTime > 0) {
                // Create a delayed version with proper timing for overlay
                const delayedLabel = `${trackLabel}_positioned`
                filters.push(`${elementFilter}[${trackLabel}_raw]`)
                filters.push(`[${trackLabel}_raw]tpad=start_duration=${startTime}[${delayedLabel}]`)
                
                videoTracks.push({
                    label: delayedLabel,
                    startTime: startTime,
                    endTime: endTime
                })
            } else {
            filters.push(`${elementFilter}[${trackLabel}]`)
            
            videoTracks.push({
                label: trackLabel,
                startTime: startTime,
                endTime: endTime
            })
            }
            
            console.log(`[Export ${this.jobId}] Built video track ${index}: ${startTime}s-${endTime}s (${duration}s) ${startTime > 0 ? 'with positioning delay' : ''}`)
        })
        
        return videoTracks
    }

    private compositeVideoTracks(filters: string[], videoTracks: Array<{label: string, startTime: number, endTime: number}>, baseTrack: string): string {
        if (videoTracks.length === 0) {
            console.log(`[Export ${this.jobId}] No video tracks to composite`)
            // If no video tracks, ensure we still have a valid output
            filters.push(`[${baseTrack}]copy[video_composite]`)
            return 'video_composite'
        }
        
        console.log(`[Export ${this.jobId}] Compositing ${videoTracks.length} video tracks with simplified overlays`)
        
        // Simplified overlay composition without problematic enable parameters
        let currentComposite = baseTrack
        let validOverlays = 0
        
        videoTracks.forEach((track, index) => {
            // Only create overlay if track has valid duration
            if (track.endTime > track.startTime) {
                const outputLabel = `overlay_${validOverlays}`
                
                // Use simplified overlay without deprecated format parameter - format is handled in input preparation
                filters.push(`[${currentComposite}][${track.label}]overlay=0:0:shortest=0[${outputLabel}]`)
                
                currentComposite = outputLabel
                validOverlays++
                console.log(`[Export ${this.jobId}] Overlaid track ${index} (${track.startTime}s-${track.endTime}s) using input timing`)
            } else {
                console.warn(`[Export ${this.jobId}] Skipping invalid overlay timing for track ${index}: ${track.startTime}s-${track.endTime}s`)
            }
        })
        
        // Ensure we have a final composite label
        if (validOverlays === 0) {
            // No valid overlays created, use base track
            filters.push(`[${baseTrack}]copy[video_composite]`)
            return 'video_composite'
        } else {
            // Rename final overlay to video_composite
            const finalOverlay = `overlay_${validOverlays - 1}`
            if (finalOverlay !== 'video_composite') {
                // Find and replace the last overlay's output label
                const lastFilterIndex = filters.length - 1
                filters[lastFilterIndex] = filters[lastFilterIndex].replace(`[${finalOverlay}]`, '[video_composite]')
            }
            return 'video_composite'
        }
    }

    private addTextAndCaptionOverlays(filters: string[], videoComposite: string): void {
        // Process BOTH text and caption elements
        const textElements = this.elements.filter(e => 
            (e.type === 'text' || e.type === 'caption') && e.text
        )
        
        if (textElements.length === 0) {
            console.log(`[Export ${this.jobId}] No text or caption overlays`)
            filters.push(`[${videoComposite}]copy[final_video]`)
            return
        }
        
        console.log(`[Export ${this.jobId}] Adding ${textElements.length} text/caption overlays with simplified filters`)
        
        let currentOutput = videoComposite
        
        textElements.forEach((element, index) => {
            // Validate text overlay duration with minimum duration
            const startSec = Math.max(0, element.timelineStartMs / 1000)
            const endSec = Math.max(startSec + MIN_DURATION_SEC, element.timelineEndMs / 1000)
            const duration = endSec - startSec
            
            // Skip if duration is still invalid
            if (duration < MIN_DURATION_SEC) {
                console.warn(`[Export ${this.jobId}] Skipping ${element.type} overlay ${index}: Duration ${duration}s too short (minimum: ${MIN_DURATION_SEC}s)`)
                return
            }
            
            // Clean and escape text for FFmpeg
            const originalText = element.text || ''
            const text = originalText
                .replace(/\\/g, '\\\\')  // Escape backslashes first
                .replace(/'/g, "\\'")    // Escape single quotes
                .replace(/:/g, '\\:')    // Escape colons
                .replace(/\n/g, '\\n')   // Escape newlines
            
            if (!originalText.trim()) {
                console.warn(`[Export ${this.jobId}] Skipping ${element.type} overlay ${index}: Empty text`)
                return
            }
            
            console.log(`[Export ${this.jobId}] Processing ${element.type} overlay ${index}: "${originalText}" -> "${text}"`)
            
            const outputLabel = index === textElements.length - 1 ? 'final_video' : `text_${index}`
            
            // Apply text directly to the video using drawtext filter with timing
            let textFilter: string
            if (element.type === 'caption') {
                textFilter = this.buildCaptionFilter(element, text, startSec, endSec)
            } else {
                textFilter = this.buildTextFilter(element, text, startSec, endSec)
            }
            
            // Apply text filter directly to the current video output with enable timing
            filters.push(`[${currentOutput}]${textFilter}[${outputLabel}]`)
            
            currentOutput = outputLabel
            
            console.log(`[Export ${this.jobId}] Added ${element.type} overlay ${index}: "${text.substring(0, 30)}..." (${startSec}s-${endSec}s, duration: ${duration}s) with timing-aware approach`)
        })
    }

    private buildTextFilter(element: TimelineElement, text: string, startSec: number, endSec: number): string {
        const fontSize = Math.max(8, element.fontSize || 24)
        const fontColor = element.fontColor || 'white'
        const fontFamily = element.fontFamily || 'Arial'
        const fontWeight = element.fontWeight || 'normal'
        
        // Parse and resolve font with enhanced fallback system
        const fontPath = this.getFontPath(fontFamily, fontWeight)
        
        // Position calculation
        const x = element.position?.x || '(w-text_w)/2'
        const y = element.position?.y || '(h-text_h)/2'
        
        // Build text filter with enable parameter for timing
        let filter = `drawtext=text='${text}':fontsize=${fontSize}:fontcolor=${fontColor}:x=${x}:y=${y}`
        
        // Temporarily disable font file usage to debug text rendering issue
        // Use only basic font family names to avoid path issues
        const safeFontFamily = fontFamily.replace(/[^a-zA-Z0-9\s]/g, '').trim() || 'Arial'
        filter += `:font='${safeFontFamily}'`
        console.log(`[Export ${this.jobId}] Text filter using safe font family: ${safeFontFamily} (original: ${fontFamily})`)
        
        // Add timing with enable parameter
        filter += `:enable='between(t,${startSec},${endSec})'`
        
        console.log(`[Export ${this.jobId}] Generated text filter: ${filter}`)
        return filter
    }

    private buildCaptionFilter(element: TimelineElement, text: string, startSec: number, endSec: number): string {
        const fontSize = Math.max(8, element.fontSize || 20)
        const fontColor = element.fontColor || 'white'
        const fontFamily = element.fontFamily || 'Impact'  // Default to Impact for captions
        const fontWeight = element.fontWeight || 'normal'
        
        // Parse and resolve font with enhanced fallback system
        const fontPath = this.getFontPath(fontFamily, fontWeight)
        
        // Caption-specific styling
        const captionStyle = element.properties?.captionStyle || {}
        const backgroundColor = captionStyle.backgroundColor || element.backgroundColor || 'black@0.8'
        const borderColor = captionStyle.borderColor || element.borderColor || 'black'
        const borderWidth = captionStyle.borderWidth || element.borderWidth || 1
        
        // Caption positioning (usually bottom center)
        const x = element.position?.x || '(w-text_w)/2'
        const y = element.position?.y || '(h-text_h-20)' // 20px from bottom
        
        // Build caption filter with background and border
        let filter = `drawtext=text='${text}':fontsize=${fontSize}:fontcolor=${fontColor}:x=${x}:y=${y}`
        
        // Temporarily disable font file usage to debug text rendering issue
        // Use only basic font family names to avoid path issues
        const safeFontFamily = fontFamily.replace(/[^a-zA-Z0-9\s]/g, '').trim() || 'Arial'
        filter += `:font='${safeFontFamily}'`
        console.log(`[Export ${this.jobId}] Caption filter using safe font family: ${safeFontFamily} (original: ${fontFamily})`)
        
        // Add caption-specific styling
        filter += `:box=1:boxcolor=${backgroundColor}:boxborderw=${borderWidth}`
        
        // Add shadow/outline for better readability
        if (captionStyle.shadow !== false) {
            filter += `:shadowcolor=black@0.5:shadowx=1:shadowy=1`
        }
        
        // Add timing with enable parameter
        filter += `:enable='between(t,${startSec},${endSec})'`
        
        console.log(`[Export ${this.jobId}] Generated caption filter: ${filter}`)
        return filter
    }

    /**
     * Parse CSS font-family string and extract the primary font family
     */
    private parseFontFamily(fontFamily?: string): string {
        if (!fontFamily) return 'Arial'
        
        // Remove quotes and split by comma to get fallback chain
        const fonts = fontFamily
            .split(',')
            .map(f => f.trim().replace(/["']/g, ''))
            .filter(f => f.length > 0)
        
        // Return the first font that's not a generic family
        const genericFamilies = ['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui']
        for (const font of fonts) {
            if (!genericFamilies.includes(font.toLowerCase())) {
                return font
            }
        }
        
        // If only generic families found, return Arial as default
        return 'Arial'
    }

    private getFontPath(fontFamily?: string, fontWeight?: string): string {
        // Enhanced font paths supporting all UI fonts across platforms
        const fontPaths: Record<string, string> = {
            // Windows fonts - Primary system fonts
            'Arial': 'C:\\Windows\\Fonts\\arial.ttf',
            'Arial-Bold': 'C:\\Windows\\Fonts\\arialbd.ttf',
            'Arial-Black': 'C:\\Windows\\Fonts\\ariblk.ttf',
            'Times New Roman': 'C:\\Windows\\Fonts\\times.ttf',
            'Times-Bold': 'C:\\Windows\\Fonts\\timesbd.ttf',
            'Verdana': 'C:\\Windows\\Fonts\\verdana.ttf',
            'Verdana-Bold': 'C:\\Windows\\Fonts\\verdanab.ttf',
            'Impact': 'C:\\Windows\\Fonts\\impact.ttf',
            'Georgia': 'C:\\Windows\\Fonts\\georgia.ttf',
            'Courier-New': 'C:\\Windows\\Fonts\\cour.ttf',
            'Trebuchet-MS': 'C:\\Windows\\Fonts\\trebuc.ttf',
            'Franklin-Gothic': 'C:\\Windows\\Fonts\\framd.ttf',
            
            // macOS fonts - System fonts
            'Helvetica': '/System/Library/Fonts/Helvetica.ttc',
            'Helvetica-Bold': '/System/Library/Fonts/Helvetica.ttc',
            'Arial-Mac': '/System/Library/Fonts/Arial.ttf',
            'Arial-Mac-Bold': '/System/Library/Fonts/Arial Bold.ttf',
            'Times-Mac': '/System/Library/Fonts/Times.ttc',
            'Impact-Mac': '/System/Library/Fonts/Impact.ttf',
            'Georgia-Mac': '/System/Library/Fonts/Georgia.ttc',
            'Courier-Mac': '/System/Library/Fonts/Courier New.ttf',
            'San-Francisco': '/System/Library/Fonts/SFNS.ttf',
            'SF-Pro': '/System/Library/Fonts/SF-Pro.ttf',
            
            // Linux fonts - Liberation (Microsoft font equivalents)
            'Liberation-Sans': '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
            'Liberation-Sans-Bold': '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
            'Liberation-Serif': '/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf',
            'Liberation-Serif-Bold': '/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf',
            'Liberation-Mono': '/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf',
            
            // DejaVu fonts (common Linux fallback)
            'DejaVu-Sans': '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
            'DejaVu-Sans-Bold': '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
            'DejaVu-Serif': '/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf',
            'DejaVu-Serif-Bold': '/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf',
            'DejaVu-Mono': '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf',
            
            // Ubuntu fonts (popular Linux distribution)
            'Ubuntu': '/usr/share/fonts/truetype/ubuntu/Ubuntu-R.ttf',
            'Ubuntu-Bold': '/usr/share/fonts/truetype/ubuntu/Ubuntu-B.ttf',
            'Ubuntu-Mono': '/usr/share/fonts/truetype/ubuntu/UbuntuMono-R.ttf',
            
            // Noto fonts (Google fonts, widely available)
            'Noto-Sans': '/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf',
            'Noto-Sans-Bold': '/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf',
            'Noto-Serif': '/usr/share/fonts/truetype/noto/NotoSerif-Regular.ttf',
            'Noto-Mono': '/usr/share/fonts/truetype/noto/NotoMono-Regular.ttf',
        }
        
        // Font family mapping - maps UI font families to available system fonts
        const fontFamilyMapping: Record<string, string[]> = {
            // Sans-serif fonts
            'Arial': ['Arial', 'Liberation-Sans', 'DejaVu-Sans', 'Ubuntu', 'Noto-Sans'],
            'Helvetica': ['Helvetica', 'Arial', 'Liberation-Sans', 'DejaVu-Sans', 'Ubuntu'],
            'Roboto': ['Liberation-Sans', 'DejaVu-Sans', 'Arial', 'Ubuntu', 'Noto-Sans'],
            'Open Sans': ['Liberation-Sans', 'DejaVu-Sans', 'Arial', 'Ubuntu', 'Noto-Sans'],
            'Montserrat': ['Liberation-Sans', 'DejaVu-Sans', 'Arial', 'Ubuntu', 'Noto-Sans'],
            'San Francisco': ['SF-Pro', 'San-Francisco', 'Helvetica', 'Arial', 'Liberation-Sans'],
            'Verdana': ['Verdana', 'DejaVu-Sans', 'Liberation-Sans', 'Arial', 'Ubuntu'],
            'Trebuchet MS': ['Trebuchet-MS', 'Liberation-Sans', 'DejaVu-Sans', 'Arial'],
            
            // Serif fonts
            'Times New Roman': ['Times-New-Roman', 'Times', 'Liberation-Serif', 'DejaVu-Serif', 'Noto-Serif'],
            'Georgia': ['Georgia', 'Liberation-Serif', 'DejaVu-Serif', 'Times', 'Noto-Serif'],
            
            // Monospace fonts
            'Courier New': ['Courier-New', 'Liberation-Mono', 'DejaVu-Mono', 'Ubuntu-Mono', 'Noto-Mono'],
            
            // Impact/Display fonts
            'Impact': ['Impact', 'Arial-Black', 'Liberation-Sans-Bold', 'DejaVu-Sans-Bold'],
            'Arial Black': ['Arial-Black', 'Impact', 'Liberation-Sans-Bold', 'DejaVu-Sans-Bold'],
            'Franklin Gothic Bold': ['Franklin-Gothic', 'Arial-Black', 'Impact', 'Liberation-Sans-Bold'],
        }
        
        // Parse CSS font-family string to get primary font
        const normalizedFamily = this.parseFontFamily(fontFamily)
        const isBold = fontWeight === 'bold' || fontWeight === '700' || fontWeight === '800' || fontWeight === '900'
        
        console.log(`[Export ${this.jobId}] Looking for font: ${normalizedFamily} (bold: ${isBold}, original: ${fontFamily})`)
        
        // Try to find the requested font family
        if (normalizedFamily && fontFamilyMapping[normalizedFamily]) {
            const candidates = fontFamilyMapping[normalizedFamily]
            
            for (const candidate of candidates) {
                const fontKey = isBold ? `${candidate}-Bold` : candidate
                if (fontPaths[fontKey]) {
                    console.log(`[Export ${this.jobId}] Found font: ${fontKey} -> ${fontPaths[fontKey]}`)
                    return fontPaths[fontKey]
                }
                // Try without bold suffix if bold version not found
                if (isBold && fontPaths[candidate]) {
                    console.log(`[Export ${this.jobId}] Found font (regular): ${candidate} -> ${fontPaths[candidate]}`)
                    return fontPaths[candidate]
                }
            }
        }
        
        // Direct font name lookup (case-insensitive)
        if (normalizedFamily) {
            const directKey = isBold ? `${normalizedFamily}-Bold` : normalizedFamily
            for (const [key, path] of Object.entries(fontPaths)) {
                if (key.toLowerCase() === directKey.toLowerCase()) {
                    console.log(`[Export ${this.jobId}] Found direct font match: ${key} -> ${path}`)
                    return path
                }
            }
        }
        
        // Universal fallback chain based on platform
        const universalFallbacks = [
            // Linux first (most common for servers)
            'Liberation-Sans', 'DejaVu-Sans', 'Ubuntu', 'Noto-Sans',
            // Windows fallbacks
            'Arial', 'Verdana',
            // macOS fallbacks
            'Helvetica', 'Arial-Mac'
        ]
        
        for (const fallbackFont of universalFallbacks) {
            const fallbackKey = isBold ? `${fallbackFont}-Bold` : fallbackFont
            if (fontPaths[fallbackKey]) {
                console.log(`[Export ${this.jobId}] Using fallback font: ${fallbackKey} -> ${fontPaths[fallbackKey]}`)
                return fontPaths[fallbackKey]
            }
            // Try regular version if bold not available
            if (isBold && fontPaths[fallbackFont]) {
                console.log(`[Export ${this.jobId}] Using fallback font (regular): ${fallbackFont} -> ${fontPaths[fallbackFont]}`)
                return fontPaths[fallbackFont]
            }
        }
        
        // Last resort: let FFmpeg use built-in font
        console.warn(`[Export ${this.jobId}] No fonts available for "${normalizedFamily}", using FFmpeg built-in font`)
        return ''
    }

    private buildAudioTracks(filters: string[], inputMapping: Map<string, number>, timelineDuration: number): Array<{label: string, startTime: number, endTime: number}> {
        const audioTracks: Array<{label: string, startTime: number, endTime: number}> = []
        
        const audioElements = this.elements
            .filter(e => ['audio'].includes(e.type) && e.assetId && this.downloadedAssets.has(e.assetId))
            .sort((a, b) => a.timelineStartMs - b.timelineStartMs)

        console.log(`[Export ${this.jobId}] Building ${audioElements.length} audio tracks`)

        audioElements.forEach((element, index) => {
                const assetPath = this.downloadedAssets.get(element.assetId!)
                const inputIndex = inputMapping.get(assetPath!)
                if (inputIndex === undefined) return

            const trackLabel = `audio_track_${index}`
            
            // Validate timeline positions with minimum duration
            const startTime = Math.max(0, element.timelineStartMs / 1000)
            const endTime = Math.max(startTime + MIN_DURATION_SEC, element.timelineEndMs / 1000)
            const duration = endTime - startTime
            
            // Additional validation - skip if still invalid
            if (duration < MIN_DURATION_SEC) {
                console.warn(`[Export ${this.jobId}] Skipping invalid audio track ${index}: ${startTime}s-${endTime}s (duration: ${duration}s, minimum: ${MIN_DURATION_SEC}s)`)
                return
            }
            
            // Build audio processing filter
                let audioFilter = `[${inputIndex}:a]`
                
                // Source trimming with validation
                if (element.sourceStartMs !== undefined && element.sourceEndMs !== undefined) {
                    const sourceStart = Math.max(0, element.sourceStartMs / 1000)
                    const sourceEnd = Math.max(sourceStart + MIN_DURATION_SEC, element.sourceEndMs / 1000)
                    const sourceDuration = sourceEnd - sourceStart
                    
                    // Only add source trimming if duration is valid
                    if (sourceDuration >= MIN_DURATION_SEC) {
                audioFilter += `atrim=start=${sourceStart}:duration=${sourceDuration},`
                        console.log(`[Export ${this.jobId}] Audio track ${index}: Source trimming ${sourceStart}s-${sourceEnd}s (${sourceDuration}s)`)
                    } else {
                        console.warn(`[Export ${this.jobId}] Audio track ${index}: Source trimming duration too short (${sourceDuration}s), skipping trim`)
                    }
                }
                
                // Speed adjustment
                if (element.speed && element.speed !== 1) {
                    audioFilter += `atempo=${element.speed},`
                }
                
                // Volume adjustment
                if (element.volume && element.volume !== 1) {
                    audioFilter += `volume=${element.volume},`
                }
                
            // Ensure exact duration (only if no source trimming was done, to avoid double atrim)
            const hasSourceTrimming = element.sourceStartMs !== undefined && element.sourceEndMs !== undefined
            if (!hasSourceTrimming) {
                audioFilter += `atrim=duration=${duration},`
            }
            audioFilter += `asetpts=PTS-STARTPTS`
            
            filters.push(`${audioFilter}[${trackLabel}]`)
            
            audioTracks.push({
                label: trackLabel,
                startTime: startTime,
                endTime: endTime
            })
            
            console.log(`[Export ${this.jobId}] Built audio track ${index}: ${startTime}s-${endTime}s (${duration}s)`)
        })
        
        return audioTracks
    }

    private mixAudioTracks(filters: string[], audioTracks: Array<{label: string, startTime: number, endTime: number}>): void {
        const timelineDuration = Math.max(this.totalDurationMs / 1000, 1) // Ensure minimum 1 second
        
        if (audioTracks.length === 0) {
            console.log(`[Export ${this.jobId}] No audio tracks - generating silence`)
            filters.push(`anullsrc=channel_layout=stereo:sample_rate=48000:duration=${timelineDuration}[final_audio]`)
            return
        }
        
        if (audioTracks.length === 1) {
            console.log(`[Export ${this.jobId}] Single audio track`)
            const track = audioTracks[0]
            
            if (track.startTime > 0 || track.endTime < timelineDuration) {
                // Audio doesn't fill timeline - pad with silence
                // Calculate the silence duration after the audio ends
                const silenceAfterDuration = Math.max(0, timelineDuration - track.endTime)
                
                if (track.startTime > MIN_DURATION_SEC && silenceAfterDuration > MIN_DURATION_SEC) {
                    // Need both before and after silence
                    filters.push(`anullsrc=channel_layout=stereo:sample_rate=48000:duration=${track.startTime}[silence_before]`)
                    filters.push(`anullsrc=channel_layout=stereo:sample_rate=48000:duration=${silenceAfterDuration}[silence_after]`)
                    filters.push(`[silence_before][${track.label}][silence_after]concat=n=3:v=0:a=1[final_audio]`)
                } else if (track.startTime > MIN_DURATION_SEC) {
                    // Need only before silence
                    filters.push(`anullsrc=channel_layout=stereo:sample_rate=48000:duration=${track.startTime}[silence_before]`)
                    filters.push(`[silence_before][${track.label}]concat=n=2:v=0:a=1[final_audio]`)
                } else if (silenceAfterDuration > MIN_DURATION_SEC) {
                    // Need only after silence
                    filters.push(`anullsrc=channel_layout=stereo:sample_rate=48000:duration=${silenceAfterDuration}[silence_after]`)
                    filters.push(`[${track.label}][silence_after]concat=n=2:v=0:a=1[final_audio]`)
                } else {
                    // No significant silence needed
                    filters.push(`[${track.label}]copy[final_audio]`)
                }
                
                console.log(`[Export ${this.jobId}] Audio track: ${track.startTime}s-${track.endTime}s, silence after: ${silenceAfterDuration}s, total: ${timelineDuration}s`)
            } else {
                filters.push(`[${track.label}]copy[final_audio]`)
            }
            return
        }
        
        console.log(`[Export ${this.jobId}] Mixing ${audioTracks.length} audio tracks`)
        
        // Multiple tracks - professional audio mixing
        // Create silence base track with validated duration
        filters.push(`anullsrc=channel_layout=stereo:sample_rate=48000:duration=${timelineDuration}[base_audio]`)
        
        let currentMix = 'base_audio'
        
        audioTracks.forEach((track, index) => {
            const outputLabel = index === audioTracks.length - 1 ? 'final_audio' : `mix_${index}`
            
            // Position audio track at correct timeline position
            if (track.startTime > MIN_DURATION_SEC) {
                const delayMs = Math.round(track.startTime * 1000)
                filters.push(`[${track.label}]adelay=${delayMs}|${delayMs}[${track.label}_delayed]`)
                filters.push(`[${currentMix}][${track.label}_delayed]amix=inputs=2:duration=longest[${outputLabel}]`)
            } else {
                filters.push(`[${currentMix}][${track.label}]amix=inputs=2:duration=longest[${outputLabel}]`)
            }
            
            currentMix = outputLabel
            console.log(`[Export ${this.jobId}] Mixed audio track ${index} at ${track.startTime}s`)
        })
    }

    private createInputMapping(): Map<string, number> {
        const mapping = new Map<string, number>()
        const uniqueAssets = [...new Set(
            this.elements
                .filter(e => e.assetId && this.downloadedAssets.has(e.assetId))
                .map(e => this.downloadedAssets.get(e.assetId!)!)
        )]
        
        console.log(`[Export ${this.jobId}] Creating input mapping for ${uniqueAssets.length} assets`)
        uniqueAssets.forEach((assetPath, index) => {
            console.log(`[Export ${this.jobId}] Mapping ${assetPath} -> input ${index}`)
            mapping.set(assetPath, index)
        })
        
        console.log(`[Export ${this.jobId}] Input mapping created successfully`)
        return mapping
    }
}

/**
 * Comprehensive validation result interface
 */
interface ValidationResult {
    valid: boolean
    errors: string[]
    warnings: string[]
    correctedElements?: TimelineElement[]
}

/**
 * Validates export settings for correctness and compatibility
 */
function validateExportSettings(settings: ExportSettings, jobId: string): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []
    
    console.log(`[Export ${jobId}] Validating export settings`)
    
    // Validate resolution
    const validResolutions = ['480p', '720p', '1080p']
    if (!validResolutions.includes(settings.resolution)) {
        errors.push(`Invalid resolution: ${settings.resolution}. Must be one of: ${validResolutions.join(', ')}`)
    }
    
    // Validate FPS
    if (!settings.fps || settings.fps < 1 || settings.fps > 120) {
        errors.push(`Invalid FPS: ${settings.fps}. Must be between 1 and 120`)
    }
    
    // Validate quality
    const validQualities = ['low', 'medium', 'high']
    if (!validQualities.includes(settings.quality)) {
        errors.push(`Invalid quality: ${settings.quality}. Must be one of: ${validQualities.join(', ')}`)
    }
    
    // Check for high-stress combinations
    if (settings.resolution === '1080p' && settings.fps > 60) {
        warnings.push('High resolution (1080p) with high FPS (>60) may cause performance issues')
    }
    
    return { valid: errors.length === 0, errors, warnings }
}

/**
 * Validates tracks structure and relationships
 */
function validateTracks(tracks: TimelineTrack[], jobId: string): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []
    
    console.log(`[Export ${jobId}] Validating ${tracks.length} tracks`)
    
    // Check track count limits
    if (tracks.length === 0) {
        errors.push('No tracks provided for export')
        return { valid: false, errors, warnings }
    }
    
    if (tracks.length > MAX_TRACKS) {
        errors.push(`Too many tracks: ${tracks.length}. Maximum allowed: ${MAX_TRACKS}`)
    }
    
    // Check for duplicate track IDs
    const trackIds = new Set<string>()
    const trackIndices = new Set<number>()
    
    tracks.forEach((track, arrayIndex) => {
        // Validate track ID
        if (!track.id || typeof track.id !== 'string') {
            errors.push(`Track ${arrayIndex}: Invalid or missing ID`)
        } else if (trackIds.has(track.id)) {
            errors.push(`Track ${arrayIndex}: Duplicate track ID: ${track.id}`)
        } else {
            trackIds.add(track.id)
        }
        
        // Validate track index
        if (typeof track.index !== 'number' || track.index < 0) {
            errors.push(`Track ${arrayIndex} (${track.id}): Invalid index: ${track.index}`)
        } else if (trackIndices.has(track.index)) {
            warnings.push(`Track ${arrayIndex} (${track.id}): Duplicate index: ${track.index}`)
        } else {
            trackIndices.add(track.index)
        }
        
        // Validate track type
        const validTypes = ['video', 'audio', 'image', 'text', 'caption']
        if (!validTypes.includes(track.type)) {
            errors.push(`Track ${arrayIndex} (${track.id}): Invalid type: ${track.type}`)
        }
        
        // Validate track name
        if (!track.name || typeof track.name !== 'string' || track.name.trim().length === 0) {
            warnings.push(`Track ${arrayIndex} (${track.id}): Missing or empty name`)
        }
    })
    
    return { valid: errors.length === 0, errors, warnings }
}

/**
 * Validates asset references and accessibility
 */
function validateAssetReferences(elements: TimelineElement[], jobId: string): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []
    
    console.log(`[Export ${jobId}] Validating asset references`)
    
    const assetIds = new Set<string>()
    const elementsWithAssets = elements.filter(e => ['video', 'audio', 'image', 'gif'].includes(e.type))
    
    elementsWithAssets.forEach((element, index) => {
        // Check for missing asset ID
        if (!element.assetId) {
            errors.push(`Element ${index} (${element.type}): Missing asset ID`)
            return
        }
        
        // Check asset ID format
        if (typeof element.assetId !== 'string' || element.assetId.trim().length === 0) {
            errors.push(`Element ${index} (${element.type}): Invalid asset ID format`)
            return
        }
        
        // Track unique assets
        assetIds.add(element.assetId)
        
        // Validate external asset structure
        if (element.assetId.startsWith('external_')) {
            const externalAsset = element.properties?.externalAsset
            if (!externalAsset?.url) {
                errors.push(`Element ${index} (${element.type}): External asset missing URL`)
            } else {
                // Basic URL validation
                try {
                    new URL(externalAsset.url)
                } catch {
                    errors.push(`Element ${index} (${element.type}): Invalid external asset URL`)
                }
            }
        }
    })
    
    // Text elements validation
    const textElements = elements.filter(e => ['text', 'caption'].includes(e.type))
    textElements.forEach((element, index) => {
        if (!element.text || element.text.trim().length === 0) {
            warnings.push(`Text element ${index}: Empty text content`)
        }
        
        // Check for extremely long text that might cause rendering issues
        if (element.text && element.text.length > 1000) {
            warnings.push(`Text element ${index}: Very long text content (${element.text.length} chars) may affect performance`)
        }
    })
    
    console.log(`[Export ${jobId}] Found ${assetIds.size} unique assets to process`)
    
    return { valid: errors.length === 0, errors, warnings }
}

/**
 * Validates timeline ranges and element positioning
 */
function validateTimelineRanges(elements: TimelineElement[], jobId: string): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []
    const correctedElements: TimelineElement[] = []
    
    console.log(`[Export ${jobId}] Validating timeline ranges for ${elements.length} elements`)
    
    if (elements.length === 0) {
        errors.push('No timeline elements provided for export')
        return { valid: false, errors, warnings, correctedElements }
    }
    
    if (elements.length > MAX_TIMELINE_ELEMENTS) {
        errors.push(`Too many timeline elements: ${elements.length}. Maximum allowed: ${MAX_TIMELINE_ELEMENTS}`)
    }
    
    let maxTimelineEnd = 0
    const elementsByTrack = new Map<string, TimelineElement[]>()
    
    elements.forEach((element, index) => {
        // Basic structure validation
        if (!element.id || typeof element.id !== 'string') {
            errors.push(`Element ${index}: Invalid or missing ID`)
        }
        
        if (!element.trackId || typeof element.trackId !== 'string') {
            errors.push(`Element ${index}: Invalid or missing track ID`)
        }
        
        // Timeline duration validation
        const duration = element.timelineEndMs - element.timelineStartMs
        const correctedElement = { ...element }
        let wasCorrected = false
        
        if (duration < MIN_DURATION_MS) {
            const newEndMs = element.timelineStartMs + MIN_DURATION_MS
            warnings.push(`Element ${index} (${element.type}): Duration ${duration}ms too short, correcting to ${MIN_DURATION_MS}ms`)
            correctedElement.timelineEndMs = newEndMs
            wasCorrected = true
        }
        
        if (duration > MAX_DURATION_MS) {
            errors.push(`Element ${index} (${element.type}): Duration ${duration}ms too long (maximum: ${MAX_DURATION_MS}ms)`)
        }
        
        // Timeline position validation
        if (element.timelineStartMs < 0) {
            warnings.push(`Element ${index} (${element.type}): Negative start time ${element.timelineStartMs}ms, correcting to 0`)
            correctedElement.timelineStartMs = 0
            correctedElement.timelineEndMs = Math.max(correctedElement.timelineEndMs, MIN_DURATION_MS)
            wasCorrected = true
        }
        
        if (element.timelineEndMs <= element.timelineStartMs) {
            errors.push(`Element ${index} (${element.type}): End time ${element.timelineEndMs}ms not after start time ${element.timelineStartMs}ms`)
        }
        
        // Source trimming validation
        if (element.sourceStartMs !== undefined && element.sourceEndMs !== undefined) {
            const sourceDuration = element.sourceEndMs - element.sourceStartMs
            
            if (sourceDuration < MIN_DURATION_MS) {
                warnings.push(`Element ${index} (${element.type}): Source duration ${sourceDuration}ms too short`)
            }
            
            if (element.sourceStartMs < 0) {
                warnings.push(`Element ${index} (${element.type}): Negative source start time`)
                correctedElement.sourceStartMs = 0
                wasCorrected = true
            }
            
            if (element.sourceEndMs <= element.sourceStartMs) {
                errors.push(`Element ${index} (${element.type}): Source end time not after start time`)
            }
        }
        
        // Track maximum timeline end
        maxTimelineEnd = Math.max(maxTimelineEnd, correctedElement.timelineEndMs)
        
        // Group elements by track for overlap detection
        if (!elementsByTrack.has(element.trackId)) {
            elementsByTrack.set(element.trackId, [])
        }
        elementsByTrack.get(element.trackId)!.push(correctedElement)
        
        correctedElements.push(wasCorrected ? correctedElement : element)
    })
    
    // Check for overlapping elements on the same track
    elementsByTrack.forEach((trackElements, trackId) => {
        const sortedElements = trackElements.sort((a, b) => a.timelineStartMs - b.timelineStartMs)
        
        for (let i = 0; i < sortedElements.length - 1; i++) {
            const current = sortedElements[i]
            const next = sortedElements[i + 1]
            
            if (current.timelineEndMs > next.timelineStartMs) {
                const overlapMs = current.timelineEndMs - next.timelineStartMs
                warnings.push(`Track ${trackId}: Elements overlap by ${overlapMs}ms (${current.id} and ${next.id})`)
            }
        }
    })
    
    // Check total timeline duration
    const totalDurationSec = maxTimelineEnd / 1000
    if (totalDurationSec > 3600) { // 1 hour
        warnings.push(`Very long timeline duration: ${totalDurationSec.toFixed(1)}s. Consider splitting into shorter segments`)
    }
    
    console.log(`[Export ${jobId}] Timeline validation: ${maxTimelineEnd}ms total duration, ${elementsByTrack.size} tracks`)
    
    return { 
        valid: errors.length === 0, 
        errors, 
        warnings,
        correctedElements: correctedElements.length > 0 ? correctedElements : undefined
    }
}

/**
 * Comprehensive validation of all export inputs
 */
function validateExportInputs(
    clips: TimelineClip[], 
    tracks: TimelineTrack[], 
    exportSettings: ExportSettings, 
    jobId: string
): ValidationResult {
    const allErrors: string[] = []
    const allWarnings: string[] = []
    let correctedElements: TimelineElement[] | undefined
    
    console.log(`[Export ${jobId}] Starting comprehensive input validation`)
    
    try {
        // Validate export settings
        const settingsValidation = validateExportSettings(exportSettings, jobId)
        allErrors.push(...settingsValidation.errors)
        allWarnings.push(...settingsValidation.warnings)
        
        // Validate tracks
        const tracksValidation = validateTracks(tracks, jobId)
        allErrors.push(...tracksValidation.errors)
        allWarnings.push(...tracksValidation.warnings)
        
        // Convert clips to elements for validation
        const elements = convertToTimelineElements(clips)
        
        // Validate asset references
        const assetsValidation = validateAssetReferences(elements, jobId)
        allErrors.push(...assetsValidation.errors)
        allWarnings.push(...assetsValidation.warnings)
        
        // Validate timeline ranges
        const timelineValidation = validateTimelineRanges(elements, jobId)
        allErrors.push(...timelineValidation.errors)
        allWarnings.push(...timelineValidation.warnings)
        correctedElements = timelineValidation.correctedElements
        
        // Summary logging
        console.log(`[Export ${jobId}] Validation complete: ${allErrors.length} errors, ${allWarnings.length} warnings`)
        
        if (allWarnings.length > 0) {
            console.warn(`[Export ${jobId}] Validation warnings:`)
            allWarnings.forEach(warning => console.warn(`  - ${warning}`))
        }
        
        if (allErrors.length > 0) {
            console.error(`[Export ${jobId}] Validation errors:`)
            allErrors.forEach(error => console.error(`  - ${error}`))
        }
        
    } catch (error) {
        const validationError = `Validation process failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        console.error(`[Export ${jobId}] ${validationError}`)
        allErrors.push(validationError)
    }
    
    return {
        valid: allErrors.length === 0,
        errors: allErrors,
        warnings: allWarnings,
        correctedElements
    }
}

/**
 * Enhanced Video Export Processing Function
 * 
 * Main orchestrator function that handles the entire export workflow with:
 * - Comprehensive input validation
 * - Robust asset downloading and verification
 * - Professional FFmpeg processing
 * - Error recovery mechanisms
 * - Progress tracking and job management
 */
async function processVideoExport(
    jobId: string,
    clips: TimelineClip[],
    tracks: TimelineTrack[],
    exportSettings: ExportSettings,
    accessToken?: string
): Promise<void> {
    const job = exportJobs.get(jobId)
    if (!job) {
        console.error(`[Export ${jobId}] Job not found`)
        return
    }

    try {
        console.log(`[Export ${jobId}] Starting enhanced video export process`)
        job.status = 'processing'
        job.progress = 0

        // Phase 1: Comprehensive Input Validation (0-10%)
        console.log(`[Export ${jobId}] Phase 1: Validating inputs`)
        const validation = validateExportInputs(clips, tracks, exportSettings, jobId)
        
        if (!validation.valid) {
            throw new Error(`Validation failed: ${validation.errors.join(', ')}`)
        }

        // Use corrected elements if validation provided fixes
        const elements = validation.correctedElements || convertToTimelineElements(clips)
        
        if (validation.warnings.length > 0) {
            console.warn(`[Export ${jobId}] Export proceeding with warnings: ${validation.warnings.join(', ')}`)
        }

        job.progress = 10
        console.log(`[Export ${jobId}] Input validation completed successfully`)

        // Phase 2: Asset Resolution and Download (10-40%)
        console.log(`[Export ${jobId}] Phase 2: Resolving and downloading assets`)
        const downloadedAssets = new Map<string, string>()
        const assetElements = elements.filter(el => {
            // Include elements with external assets
            if (el.properties?.externalAsset) return true
            
            // Include elements with valid asset IDs (not missing/external/invalid)
            if (el.assetId && 
                !el.assetId.startsWith('missing_') && 
                !el.assetId.startsWith('external_')) {
                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
                return uuidRegex.test(el.assetId)
            }
            
            return false
        })
        
        console.log(`[Export ${jobId}] Found ${assetElements.length} valid assets to download from ${elements.length} total elements`)
        
        let successfulDownloads = 0 // Declare outside to be accessible later
        
        if (assetElements.length === 0) {
            console.log(`[Export ${jobId}] No assets to download, proceeding to export`)
        } else {
            const progressPerAsset = 30 / assetElements.length

            for (let i = 0; i < assetElements.length; i++) {
                const element = assetElements[i]

                            try {
                    let assetUrl: string
                    let filename: string

                    if (element.properties?.externalAsset) {
                        // External asset (e.g., from Freesound, Unsplash)
                        assetUrl = element.properties.externalAsset.url
                        const urlParts = new URL(assetUrl)
                        filename = `external_${element.id}_${path.basename(urlParts.pathname) || 'asset'}`
                        console.log(`[Export ${jobId}] Processing external asset: ${element.properties.externalAsset.platform}`)
                    } else if (element.assetId) {
                        // Check for invalid or missing asset IDs
                        if (element.assetId.startsWith('missing_') || element.assetId.startsWith('external_')) {
                            console.warn(`[Export ${jobId}] Skipping invalid asset ID: ${element.assetId} for element ${element.id}`)
                            continue
                        }
                        
                        // Validate UUID format for database asset IDs
                        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
                        if (!uuidRegex.test(element.assetId)) {
                            console.warn(`[Export ${jobId}] Skipping invalid UUID format: ${element.assetId} for element ${element.id}`)
                            continue
                        }
                        
                        // Internal asset from database
                        assetUrl = await fetchAssetUrl(element.assetId)
                        filename = `asset_${element.assetId}`
                        console.log(`[Export ${jobId}] Processing internal asset: ${element.assetId}`)
                    } else {
                        continue
                    }

                    // Enhanced download with retry mechanism
                    const localPath = await downloadAssetWithValidation(assetUrl, filename, jobId)
                    const assetKey = element.assetId || element.id
                    downloadedAssets.set(assetKey, localPath)
                    successfulDownloads++

                    job.progress = 10 + (i + 1) * progressPerAsset
                    console.log(`[Export ${jobId}] Downloaded asset ${i + 1}/${assetElements.length} (${Math.round(job.progress)}%)`)

                } catch (error) {
                    const errorMsg = `Failed to download asset for element ${element.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
                    console.error(`[Export ${jobId}] ${errorMsg}`)
                    
                    // Continue with export instead of failing completely
                    console.warn(`[Export ${jobId}] Continuing export without asset for element ${element.id}`)
                    
                    // Still update progress
                    job.progress = 10 + (i + 1) * progressPerAsset
                }
            }
        }

        job.progress = 40
        console.log(`[Export ${jobId}] Asset download phase completed`)
        console.log(`[Export ${jobId}] Successfully downloaded ${successfulDownloads}/${assetElements.length} assets`)
        
        if (successfulDownloads < assetElements.length) {
            const failedCount = assetElements.length - successfulDownloads
            console.warn(`[Export ${jobId}] Warning: ${failedCount} assets failed to download - continuing export without them`)
        }

        // Phase 3: Output Configuration (40-45%)
        console.log(`[Export ${jobId}] Phase 3: Configuring output settings`)
        const outputSettings = getOutputSettings(exportSettings)
        const outputPath = path.join(EXPORTS_DIR, `export_${jobId}.mp4`)

        job.progress = 45
        console.log(`[Export ${jobId}] Output configuration: ${outputSettings.width}x${outputSettings.height} @ ${outputSettings.fps}fps`)

        // Phase 4: Professional Video Export (45-90%)
        console.log(`[Export ${jobId}] Phase 4: Starting FFmpeg video processing`)
        const exporter = new ProfessionalVideoExporter(
            elements,
            tracks,
            outputSettings,
            downloadedAssets,
            jobId
        )

        // Set up progress monitoring for FFmpeg
        const exportPromise = exporter.exportVideo(outputPath)
        
        // Monitor FFmpeg progress (simplified progress tracking)
        const progressInterval = setInterval(() => {
            if (job.progress < 85) {
                job.progress = Math.min(85, job.progress + 2)
            }
        }, 2000)

        await exportPromise
        clearInterval(progressInterval)

        job.progress = 90
        console.log(`[Export ${jobId}] FFmpeg processing completed successfully`)

        // Phase 5: File Verification and Upload (90-100%)
        console.log(`[Export ${jobId}] Phase 5: Verifying and uploading output`)
        
        // Verify the output file exists and has content
        try {
            const stats = await fs.stat(outputPath)
            if (stats.size === 0) {
                throw new Error('Output file is empty')
            }
            console.log(`[Export ${jobId}] Output file verified: ${(stats.size / 1024 / 1024).toFixed(2)} MB`)
        } catch (error) {
            throw new Error(`Output file verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }

        // Upload to Google Cloud Storage
        const uploadName = `exports/video_${jobId}_${Date.now()}.mp4`
        await bucket.upload(outputPath, {
            destination: uploadName,
            metadata: {
                contentType: 'video/mp4',
                cacheControl: 'no-cache'
            }
        })

        // Generate signed URL for secure download (valid for 24 hours)
        const [downloadUrl] = await bucket.file(uploadName).getSignedUrl({
            action: 'read',
            expires: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
        })
        
        console.log(`[Export ${jobId}] Generated signed download URL (24h expiry)`)
        
        // Cleanup local files
        try {
            await fs.unlink(outputPath)
            for (const localPath of downloadedAssets.values()) {
                try {
                    await fs.unlink(localPath)
                } catch (cleanupError) {
                    console.warn(`[Export ${jobId}] Failed to cleanup asset: ${cleanupError}`)
                }
            }
        } catch (cleanupError) {
            console.warn(`[Export ${jobId}] Cleanup warning: ${cleanupError}`)
        }

        // Complete the job
        job.status = 'completed'
        job.progress = 100
        job.downloadUrl = downloadUrl
        job.completedAt = new Date()
        job.outputPath = outputPath

        console.log(`[Export ${jobId}] Enhanced export completed successfully`)
        console.log(`[Export ${jobId}] Download URL: ${downloadUrl}`)

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
        console.error(`[Export ${jobId}] Export failed: ${errorMessage}`)
        
        job.status = 'failed'
        job.error = errorMessage
        
        // Cleanup on failure
        try {
            const outputPath = path.join(EXPORTS_DIR, `export_${jobId}.mp4`)
            await fs.unlink(outputPath).catch(() => {})
        } catch (cleanupError) {
            console.warn(`[Export ${jobId}] Failed to cleanup on error: ${cleanupError}`)
        }
    }
}

/**
 * Enhanced asset download with validation and retry mechanism
 */
async function downloadAssetWithValidation(
    url: string, 
    filename: string, 
    jobId: string, 
    maxRetries: number = 3
): Promise<string> {
    let lastError: Error = new Error('Download failed')
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`[Export ${jobId}] Downloading asset attempt ${attempt}/${maxRetries}: ${url}`)
            
            const localPath = await downloadAsset(url, filename, 1)
            
            // Validate downloaded file
            const stats = await fs.stat(localPath)
            if (stats.size === 0) {
                throw new Error('Downloaded file is empty')
            }
            
            // Basic file type validation
            const ext = path.extname(localPath).toLowerCase()
            if (!['.mp4', '.mov', '.avi', '.mp3', '.wav', '.jpg', '.jpeg', '.png', '.gif'].includes(ext)) {
                console.warn(`[Export ${jobId}] Unknown file extension: ${ext}`)
            }
            
            console.log(`[Export ${jobId}] Asset downloaded and validated: ${(stats.size / 1024).toFixed(1)}KB`)
            return localPath
            
    } catch (error) {
            lastError = error instanceof Error ? error : new Error(`Unknown error on attempt ${attempt}`)
            console.warn(`[Export ${jobId}] Download attempt ${attempt} failed: ${lastError.message}`)
            
            if (attempt < maxRetries) {
                const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000)
                console.log(`[Export ${jobId}] Waiting ${delay}ms before retry...`)
                await new Promise(resolve => setTimeout(resolve, delay))
            }
        }
    }
    
    throw new Error(`Failed to download asset after ${maxRetries} attempts: ${lastError.message}`)
}

/**
 * Get optimized output settings based on export configuration
 */
function getOutputSettings(exportSettings: ExportSettings) {
    const resolutionMap = {
        '480p': { width: 854, height: 480 },
        '720p': { width: 1280, height: 720 },
        '1080p': { width: 1920, height: 1080 }
    }
    
    return {
        ...resolutionMap[exportSettings.resolution],
        fps: exportSettings.fps,
        quality: exportSettings.quality
    }
}

// Routes
router.post('/start', validateExportRequest, async (req: Request, res: Response) => {
    try {
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() })
        }

        const { clips, tracks, exportSettings } = req.body
        const accessToken = req.headers.authorization?.replace('Bearer ', '')

        const jobId = uuid()
        const job: ExportJob = {
            id: jobId,
            status: 'queued',
            progress: 0,
            createdAt: new Date(),
            exportSettings
        }

        exportJobs.set(jobId, job)
        processVideoExport(jobId, clips, tracks, exportSettings, accessToken)

        res.json({ success: true, jobId, message: 'Professional export started' })
    } catch (error) {
        res.status(500).json({ success: false, error: 'Export failed to start' })
    }
})

router.get('/status/:jobId', (req, res) => {
    const job = exportJobs.get(req.params.jobId)
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' })
    
    res.json({
        success: true,
        job: {
            id: job.id,
            status: job.status,
            progress: job.progress,
            error: job.error,
            downloadUrl: job.downloadUrl,
            createdAt: job.createdAt,
            completedAt: job.completedAt
        }
    })
})

router.delete('/cancel/:jobId', (req, res) => {
    const job = exportJobs.get(req.params.jobId)
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' })
    
    job.status = 'failed'
    job.error = 'Cancelled by user'
    res.json({ success: true, message: 'Job cancelled' })
})

// Download proxy endpoint for handling CORS issues
router.get('/download/:jobId', async (req, res) => {
    try {
        const job = exportJobs.get(req.params.jobId)
        if (!job) {
            return res.status(404).json({ success: false, error: 'Job not found' })
        }

        if (job.status !== 'completed' || !job.downloadUrl) {
            return res.status(400).json({ success: false, error: 'Export not ready for download' })
        }

        console.log(`[Export ${req.params.jobId}] Proxying download request`)

        // Fetch the file from GCS
        const response = await fetch(job.downloadUrl)
        if (!response.ok) {
            throw new Error(`Failed to fetch file: ${response.status}`)
        }

        // Set appropriate headers for download
        const filename = `video-export-${Date.now()}.mp4`
        res.setHeader('Content-Type', 'video/mp4')
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
        res.setHeader('Cache-Control', 'no-cache')
        
        if (response.headers.get('content-length')) {
            res.setHeader('Content-Length', response.headers.get('content-length')!)
        }

        // Stream the file to the client
        if (response.body) {
            const reader = response.body.getReader()
            const stream = (await import('stream')).Readable.from(async function* () {
                try {
                    while (true) {
                        const { done, value } = await reader.read()
                        if (done) break
                        yield value
                    }
                } finally {
                    reader.releaseLock()
                }
            }())
            
            stream.pipe(res)
        } else {
            throw new Error('No response body available')
        }

    } catch (error) {
        console.error(`[Export] Download proxy error:`, error)
        if (!res.headersSent) {
            res.status(500).json({ 
                success: false, 
                error: error instanceof Error ? error.message : 'Download failed' 
            })
        }
    }
})

export default router 