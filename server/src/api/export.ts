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
        // Use the simplest possible approach - direct video processing without complex filters
        const videoElements = this.elements.filter(e => 
            ['video', 'image'].includes(e.type) && e.assetId && this.downloadedAssets.has(e.assetId)
        )
        
        const audioElements = this.elements.filter(e => 
            ['video', 'audio'].includes(e.type) && e.assetId && this.downloadedAssets.has(e.assetId)
        )

        console.log(`[Export ${this.jobId}] Simple export: ${videoElements.length} video, ${audioElements.length} audio elements`)

        if (videoElements.length === 0) {
            // No video - create a simple black video with audio
            return this.createBlackVideoWithAudio(outputPath, audioElements)
        }

        if (videoElements.length === 1 && audioElements.length <= 1) {
            // Single video - process directly without complex filters
            return this.processSingleVideo(outputPath, videoElements[0], audioElements[0])
        }

        // Multiple videos - use simple concatenation
        return this.processMultipleVideos(outputPath, videoElements, audioElements)
    }

    private async createBlackVideoWithAudio(outputPath: string, audioElements: TimelineElement[]): Promise<void> {
        const ffmpegCommand = ffmpeg()
        const duration = this.totalDurationMs / 1000

        // Create black video
        ffmpegCommand
            .input(`color=black:size=${this.outputSettings.width}x${this.outputSettings.height}:duration=${duration}:rate=${this.outputSettings.fps}`)
            .inputFormat('lavfi')

        // Add audio if available
        if (audioElements.length > 0) {
            const audioPath = this.downloadedAssets.get(audioElements[0].assetId!)!
            ffmpegCommand.input(audioPath)
            
            ffmpegCommand
                .outputOptions([
                    '-c:v', 'libx264',
                    '-c:a', 'aac',
                    '-preset', 'fast',
                    '-pix_fmt', 'yuv420p',
                    '-shortest'
                ])
        } else {
            ffmpegCommand
                .outputOptions([
                    '-c:v', 'libx264',
                    '-preset', 'fast',
                    '-pix_fmt', 'yuv420p',
                    '-an' // no audio
                ])
        }

        ffmpegCommand.output(outputPath)

        return new Promise((resolve, reject) => {
            ffmpegCommand
                .on('end', () => resolve())
                .on('error', (err: any) => reject(err))
                .run()
        })
    }

    private async processSingleVideo(outputPath: string, videoElement: TimelineElement, audioElement?: TimelineElement): Promise<void> {
        const videoPath = this.downloadedAssets.get(videoElement.assetId!)!
        const ffmpegCommand = ffmpeg()

        ffmpegCommand.input(videoPath)

        // Add audio input if different from video
        if (audioElement && audioElement.assetId !== videoElement.assetId) {
            const audioPath = this.downloadedAssets.get(audioElement.assetId!)!
            ffmpegCommand.input(audioPath)
        }

        // Simple video processing
        const videoFilters: string[] = []
        
        // Source trimming
        if (videoElement.sourceStartMs !== undefined && videoElement.sourceEndMs !== undefined) {
            const startSec = videoElement.sourceStartMs / 1000
            const durationSec = (videoElement.sourceEndMs - videoElement.sourceStartMs) / 1000
            ffmpegCommand.seekInput(startSec).duration(durationSec)
        }

        // Scaling
        videoFilters.push(`scale=${this.outputSettings.width}:${this.outputSettings.height}:force_original_aspect_ratio=decrease`)
        videoFilters.push(`pad=${this.outputSettings.width}:${this.outputSettings.height}:(ow-iw)/2:(oh-ih)/2:black`)

        // Add text overlays if any
        const textElements = this.elements.filter(e => e.type === 'text' || e.type === 'caption')
        textElements.forEach((textElement, index) => {
            const text = textElement.text || 'Sample Text'
            const fontSize = textElement.fontSize || 24
            const fontColor = textElement.fontColor || 'white'
            const x = textElement.position?.x || 'center'
            const y = textElement.position?.y || 'center'
            
            videoFilters.push(`drawtext=text='${text.replace(/'/g, "\\'")}':fontsize=${fontSize}:fontcolor=${fontColor}:x=${x}:y=${y}`)
        })

        if (videoFilters.length > 0) {
            ffmpegCommand.videoFilters(videoFilters)
        }

        ffmpegCommand
            .outputOptions([
                '-c:v', 'libx264',
                '-c:a', 'aac',
                '-preset', 'fast',
                '-crf', '23',
                '-pix_fmt', 'yuv420p',
                '-movflags', '+faststart'
            ])
            .output(outputPath)

        return new Promise((resolve, reject) => {
            ffmpegCommand
                .on('end', () => resolve())
                .on('error', (err: any) => reject(err))
                .run()
        })
    }

    private async processMultipleVideos(outputPath: string, videoElements: TimelineElement[], audioElements: TimelineElement[]): Promise<void> {
        // For now, just use the first video element to avoid complex concatenation
        const primaryVideo = videoElements[0]
        const primaryAudio = audioElements.length > 0 ? audioElements[0] : undefined
        
        console.log(`[Export ${this.jobId}] Using primary video for multi-element export (simplified)`)
        return this.processSingleVideo(outputPath, primaryVideo, primaryAudio)
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