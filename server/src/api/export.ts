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
    position?: { x: number, y: number }
    transitionIn?: { type: string, duration: number }
    transitionOut?: { type: string, duration: number }
    properties?: {
        externalAsset?: { url: string, platform: string }
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

async function downloadAsset(url: string, filename: string): Promise<string> {
    console.log(`[Download] Starting download: ${filename}`)
    console.log(`[Download] URL: ${url.substring(0, 100)}...`)
    
    // Add timeout to prevent hanging
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout
    
    try {
        const response = await fetch(url, { 
            signal: controller.signal,
            headers: {
                'User-Agent': 'Lemona-Server/1.0'
            }
        })
        
        clearTimeout(timeoutId)
        
    if (!response.ok) {
            throw new Error(`Download failed: ${response.status} ${response.statusText}`)
    }
        
        console.log(`[Download] Response OK for ${filename}, size: ${response.headers.get('content-length')} bytes`)
    
    const buffer = await response.arrayBuffer()
    const filePath = path.join(TEMP_DIR, filename)
    await fs.writeFile(filePath, Buffer.from(buffer))
        
        console.log(`[Download] Saved ${filename} to ${filePath}`)
    return filePath
        
    } catch (error) {
        clearTimeout(timeoutId)
        console.error(`[Download] Failed to download ${filename}:`, error)
        
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error(`Download timeout after 30 seconds for ${filename}`)
        }
        
        throw new Error(`Download failed for ${filename}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
}

function convertToTimelineElements(clips: TimelineClip[]): TimelineElement[] {
    return clips.map(clip => ({
        id: clip.id,
        type: clip.type as any,
        trackId: clip.trackId,
        timelineStartMs: clip.timelineStartMs,
        timelineEndMs: clip.timelineEndMs,
        sourceStartMs: clip.sourceStartMs,
        sourceEndMs: clip.sourceEndMs,
        assetId: clip.assetId,
        speed: clip.speed,
        volume: clip.volume,
        text: clip.properties?.text,
        fontSize: clip.properties?.fontSize,
        fontColor: clip.properties?.fontColor,
        position: clip.properties?.position,
        properties: clip.properties
    }))
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
        this.totalDurationMs = Math.max(...elements.map(e => e.timelineEndMs), 2000)
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
        
        ffmpegCommand
            .complexFilter(filterGraph)
            .outputOptions([
                '-map', '[final_video]',
                '-map', '[final_audio]',
                '-c:v', 'libx264',
                '-c:a', 'aac',
                '-preset', 'medium',
                '-crf', '23',
                '-pix_fmt', 'yuv420p',
                '-movflags', '+faststart'
            ])
            .output(outputPath)
        
        return new Promise((resolve, reject) => {
            ffmpegCommand
                .on('end', () => {
                    resolve()
                })
                .on('error', (err: any, _stdout: string | null, _stderr: string | null) => {
                    reject(err)
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
        
        // Professional approach: Build synchronized timeline using complex filter graph
        const timelineDurationSec = this.totalDurationMs / 1000
        const backgroundIndex = inputMapping.size
        
        // Step 1: Create master timeline background with exact duration AND matching resolution
        filters.push(`[${backgroundIndex}:v]trim=duration=${timelineDurationSec},setpts=PTS-STARTPTS,scale=${this.outputSettings.width}:${this.outputSettings.height}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${this.outputSettings.width}:${this.outputSettings.height}:(ow-iw)/2:(oh-ih)/2:black,format=yuv420p,fps=${this.outputSettings.fps}[master_timeline]`)
        
        // Step 2: Process all video elements with timeline synchronization
        const videoTracks = this.buildVideoTracks(filters, inputMapping, timelineDurationSec)
        
        // Step 3: Process all audio elements with timeline synchronization  
        const audioTracks = this.buildAudioTracks(filters, inputMapping, timelineDurationSec)
        
        // Step 4: Composite video tracks using professional overlay composition
        const finalVideo = this.compositeVideoTracks(filters, videoTracks, 'master_timeline')
        
        // Step 5: Add text overlays with precise timing
        this.addTextOverlays(filters, finalVideo)
        
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
            const startTime = element.timelineStartMs / 1000
            const endTime = element.timelineEndMs / 1000
            const duration = endTime - startTime
            
            // Skip zero-duration tracks to prevent FFmpeg errors
            if (duration <= 0) {
                console.warn(`[Export ${this.jobId}] Skipping zero-duration video track ${index}: ${startTime}s-${endTime}s`)
                return
            }
            
            // Build element processing filter
            let elementFilter = `[${inputIndex}:v]`
        
            // Source trimming
            if (element.sourceStartMs !== undefined && element.sourceEndMs !== undefined) {
                const sourceStart = element.sourceStartMs / 1000
                const sourceDuration = (element.sourceEndMs - element.sourceStartMs) / 1000
                elementFilter += `trim=start=${sourceStart}:duration=${sourceDuration},setpts=PTS-STARTPTS,`
            }
        
            // Speed adjustment
            if (element.speed && element.speed !== 1) {
                elementFilter += `setpts=${1/element.speed}*PTS,`
            }
        
            // Image duration handling
            if (element.type === 'image') {
                elementFilter += `loop=loop=-1:size=1:start=0,setpts=N/(${this.outputSettings.fps}*TB),trim=duration=${duration},`
            }
            
            // Professional scaling and formatting
            elementFilter += `scale=${this.outputSettings.width}:${this.outputSettings.height}:force_original_aspect_ratio=decrease:flags=lanczos,`
            elementFilter += `pad=${this.outputSettings.width}:${this.outputSettings.height}:(ow-iw)/2:(oh-ih)/2:black,`
            elementFilter += `format=yuv420p,fps=${this.outputSettings.fps}`
            
            // Effects
            if (element.opacity && element.opacity !== 1) {
                elementFilter += `,colorchannelmixer=aa=${element.opacity}`
            }
        
            // Transitions
            if (element.transitionIn) {
                const transitionDuration = element.transitionIn.duration || 0.5
                elementFilter += `,fade=t=in:st=0:d=${transitionDuration}`
            }
            
            if (element.transitionOut) {
                const transitionDuration = element.transitionOut.duration || 0.5
                const transitionStart = Math.max(0, duration - transitionDuration)
                elementFilter += `,fade=t=out:st=${transitionStart}:d=${transitionDuration}`
            }
            
            // Ensure exact timeline duration matching
            elementFilter += `,trim=duration=${duration},setpts=PTS-STARTPTS`
            
            filters.push(`${elementFilter}[${trackLabel}]`)
            
            videoTracks.push({
                label: trackLabel,
                startTime: startTime,
                endTime: endTime
            })
            
            console.log(`[Export ${this.jobId}] Built video track ${index}: ${startTime}s-${endTime}s (${duration}s)`)
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
        
        console.log(`[Export ${this.jobId}] Compositing ${videoTracks.length} video tracks`)
        
        // Professional overlay composition with enable timing
        let currentComposite = baseTrack
        let validOverlays = 0
        
        videoTracks.forEach((track, index) => {
            // Only create overlay if track has valid duration
            if (track.endTime > track.startTime) {
                const outputLabel = `overlay_${validOverlays}`
                
                // Use overlay with enable parameter for precise timing
                const enableExpr = `between(t,${track.startTime},${track.endTime})`
                filters.push(`[${currentComposite}][${track.label}]overlay=0:0:format=yuv420p:eval=frame:enable='${enableExpr}':shortest=0[${outputLabel}]`)
                
                currentComposite = outputLabel
                validOverlays++
                console.log(`[Export ${this.jobId}] Overlaid track ${index} with timing ${track.startTime}s-${track.endTime}s`)
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

    private addTextOverlays(filters: string[], videoComposite: string): void {
        const textElements = this.elements.filter(e => e.type === 'text' && e.text)
        
        if (textElements.length === 0) {
            console.log(`[Export ${this.jobId}] No text overlays`)
            filters.push(`[${videoComposite}]copy[final_video]`)
            return
        }
        
        console.log(`[Export ${this.jobId}] Adding ${textElements.length} text overlays`)
        
        let currentOutput = videoComposite
        
        textElements.forEach((element, index) => {
            const startSec = element.timelineStartMs / 1000
            const endSec = element.timelineEndMs / 1000
            const text = (element.text || '').replace(/'/g, "\\'")
            const fontSize = element.fontSize || 24
            const fontColor = element.fontColor || 'white'
            const x = element.position?.x || 'center'
            const y = element.position?.y || 'center'
            
            const outputLabel = index === textElements.length - 1 ? 'final_video' : `text_${index}`
            
            const textFilter = `drawtext=text='${text}':fontsize=${fontSize}:fontcolor=${fontColor}:x=${x}:y=${y}:enable='between(t,${startSec},${endSec})'`
            filters.push(`[${currentOutput}]${textFilter}[${outputLabel}]`)
            currentOutput = outputLabel
            
            console.log(`[Export ${this.jobId}] Added text overlay ${index}: "${text}" (${startSec}s-${endSec}s)`)
        })
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
            const startTime = element.timelineStartMs / 1000
            const endTime = element.timelineEndMs / 1000
            const duration = endTime - startTime
            
            // Skip zero-duration tracks
            if (duration <= 0) {
                console.warn(`[Export ${this.jobId}] Skipping zero-duration audio track ${index}: ${startTime}s-${endTime}s`)
                return
            }
            
            // Build audio processing filter
            let audioFilter = `[${inputIndex}:a]`
            
            // Source trimming
            if (element.sourceStartMs !== undefined && element.sourceEndMs !== undefined) {
                const sourceStart = element.sourceStartMs / 1000
                const sourceDuration = (element.sourceEndMs - element.sourceStartMs) / 1000
                audioFilter += `atrim=start=${sourceStart}:duration=${sourceDuration},`
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
            if (element.sourceStartMs === undefined || element.sourceEndMs === undefined) {
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
        const timelineDuration = this.totalDurationMs / 1000
        
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
                if (track.startTime > 0 && track.endTime < timelineDuration) {
                    // Need both before and after silence
                    filters.push(`anullsrc=channel_layout=stereo:sample_rate=48000:duration=${track.startTime}[silence_before]`)
                    filters.push(`anullsrc=channel_layout=stereo:sample_rate=48000:duration=${timelineDuration - track.endTime}[silence_after]`)
                    filters.push(`[silence_before][${track.label}][silence_after]concat=n=3:v=0:a=1[final_audio]`)
                } else if (track.startTime > 0) {
                    // Need only before silence
                    filters.push(`anullsrc=channel_layout=stereo:sample_rate=48000:duration=${track.startTime}[silence_before]`)
                    filters.push(`[silence_before][${track.label}]concat=n=2:v=0:a=1[final_audio]`)
                } else if (track.endTime < timelineDuration) {
                    // Need only after silence
                    filters.push(`anullsrc=channel_layout=stereo:sample_rate=48000:duration=${timelineDuration - track.endTime}[silence_after]`)
                    filters.push(`[${track.label}][silence_after]concat=n=2:v=0:a=1[final_audio]`)
                } else {
                    filters.push(`[${track.label}]copy[final_audio]`)
                }
            } else {
                filters.push(`[${track.label}]copy[final_audio]`)
            }
            return
        }
        
        console.log(`[Export ${this.jobId}] Mixing ${audioTracks.length} audio tracks`)
        
        // Multiple tracks - professional audio mixing
        // Create silence base track
        filters.push(`anullsrc=channel_layout=stereo:sample_rate=48000:duration=${timelineDuration}[base_audio]`)
        
        let currentMix = 'base_audio'
        
        audioTracks.forEach((track, index) => {
            const outputLabel = index === audioTracks.length - 1 ? 'final_audio' : `mix_${index}`
            
            // Position audio track at correct timeline position
            if (track.startTime > 0) {
                filters.push(`[${track.label}]adelay=${track.startTime * 1000}|${track.startTime * 1000}[${track.label}_delayed]`)
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

async function processVideoExport(jobId: string, clips: TimelineClip[], tracks: TimelineTrack[], exportSettings: ExportSettings, accessToken?: string): Promise<void> {
    const job = exportJobs.get(jobId)
    if (!job) return

    let downloadedAssets = new Map<string, string>()

    try {
        job.status = 'processing'
        job.progress = 5

        console.log(`[Export ${jobId}] Professional export starting...`)

        const elements = convertToTimelineElements(clips)
        const totalDurationMs = Math.max(...elements.map(e => e.timelineEndMs), 2000)

        const validElements = elements.filter(e => 
            ['video', 'image', 'audio'].includes(e.type) && e.assetId
        )

        // Download assets
        console.log(`[Export ${jobId}] Starting asset downloads for ${validElements.length} elements`)
        
        if (validElements.length === 0) {
            console.log(`[Export ${jobId}] No valid elements found for export`)
            throw new Error('No valid media elements found for export')
        }
        
        for (let i = 0; i < validElements.length; i++) {
            const element = validElements[i]
            if (!element.assetId) continue

            console.log(`[Export ${jobId}] Processing asset ${i + 1}/${validElements.length}: ${element.assetId}`)

            try {
                let assetUrl: string
                if (element.assetId.startsWith('external_')) {
                    assetUrl = element.properties?.externalAsset?.url || ''
                    if (!assetUrl) throw new Error(`External asset missing URL`)
                    console.log(`[Export ${jobId}] External asset URL: ${assetUrl.substring(0, 100)}...`)
                } else {
                    console.log(`[Export ${jobId}] Fetching internal asset URL for: ${element.assetId}`)
                    assetUrl = await fetchAssetUrl(element.assetId)
                }

                const ext = path.extname(assetUrl.split('?')[0]) || '.mp4'
                const filename = `${jobId}_${i}${ext}`
                
                console.log(`[Export ${jobId}] Downloading ${filename}...`)
                const filePath = await downloadAsset(assetUrl, filename)
                
                downloadedAssets.set(element.assetId, filePath)
                job.progress = 5 + Math.round(((i + 1) / validElements.length) * 30)
                
                console.log(`[Export ${jobId}] Asset ${i + 1}/${validElements.length} downloaded successfully. Progress: ${job.progress}%`)
                
            } catch (error) {
                console.error(`[Export ${jobId}] Failed to download asset ${element.assetId}:`, error)
                throw new Error(`Asset download failed for ${element.assetId}: ${error instanceof Error ? error.message : 'Unknown error'}`)
            }
        }
        
        console.log(`[Export ${jobId}] All assets downloaded successfully`)

        job.progress = 35

        const resolutionMap = {
            '480p': { width: 480, height: 854 },
            '720p': { width: 720, height: 1280 },
            '1080p': { width: 1080, height: 1920 }
        }

        const { width, height } = resolutionMap[exportSettings.resolution]
        const outputPath = path.join(EXPORTS_DIR, `${jobId}.mp4`)

        const exporter = new ProfessionalVideoExporter(
            elements, tracks, { width, height, fps: exportSettings.fps }, downloadedAssets, jobId
        )

        await exporter.exportVideo(outputPath)

        // Upload
        job.progress = 95
        const cloudFileName = `exports/${jobId}.mp4`
        await bucket.upload(outputPath, { destination: cloudFileName })

        const [downloadUrl] = await bucket.file(cloudFileName).getSignedUrl({
            action: 'read',
            expires: Date.now() + 24 * 60 * 60 * 1000
        })

        job.status = 'completed'
        job.progress = 100
        job.downloadUrl = downloadUrl
        job.completedAt = new Date()

        // Cleanup
        for (const filePath of downloadedAssets.values()) {
            try { await fs.unlink(filePath) } catch {}
        }

    } catch (error) {
        console.error(`[Export ${jobId}] Export failed:`, error)
        
        job.status = 'failed'
        job.progress = 0
        job.error = error instanceof Error ? error.message : 'Unknown error'
        
        console.log(`[Export ${jobId}] Job marked as failed with error: ${job.error}`)
        
        // Clean up any downloaded assets
        for (const filePath of downloadedAssets.values()) {
            try { 
                await fs.unlink(filePath)
                console.log(`[Export ${jobId}] Cleaned up file: ${filePath}`)
            } catch (cleanupError) {
                console.warn(`[Export ${jobId}] Failed to cleanup file: ${filePath}`, cleanupError)
            }
        }
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