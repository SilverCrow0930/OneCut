import express from 'express'
import { body, validationResult } from 'express-validator'
import ffmpeg from 'fluent-ffmpeg'
import { Storage } from '@google-cloud/storage'
import { v4 as uuid } from 'uuid'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import cron from 'node-cron'
import { Request, Response } from 'express'
import { supabase } from '../config/supabaseClient.js'

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

// Initialize Google Cloud Storage
const storage = new Storage()
const bucketName = process.env.GCLOUD_STORAGE_BUCKET || 'lemona-app-assets'

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Create temp directories
const TEMP_DIR = path.join(__dirname, '../../temp')
const EXPORTS_DIR = path.join(TEMP_DIR, 'exports')

// Ensure directories exist
async function ensureDirectories() {
    try {
        await fs.mkdir(TEMP_DIR, { recursive: true })
        await fs.mkdir(EXPORTS_DIR, { recursive: true })
    } catch (error) {
        console.error('Failed to create temp directories:', error)
    }
}

ensureDirectories()

// Export job tracking
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

// In-memory job storage (in production, use Redis or database)
const exportJobs = new Map<string, ExportJob>()

// Cleanup old exports every hour
cron.schedule('0 * * * *', () => {
    cleanupOldExports()
})

async function cleanupOldExports() {
    try {
        const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours ago
        
        for (const [jobId, job] of exportJobs.entries()) {
            if (job.createdAt < cutoffTime) {
                // Delete the file if it exists
                if (job.outputPath) {
                    try {
                        await fs.unlink(job.outputPath)
                    } catch (error) {
                        console.error('Failed to delete export file:', error)
                    }
                }
                
                // Remove from tracking
                exportJobs.delete(jobId)
                console.log(`Cleaned up old export: ${jobId}`)
            }
        }
    } catch (error) {
        console.error('Error during export cleanup:', error)
    }
}

// Validation middleware
const validateExportRequest = [
    body('clips').isArray().withMessage('Clips must be an array'),
    body('tracks').isArray().withMessage('Tracks must be an array'),
    body('exportSettings.resolution').isIn(['480p', '720p', '1080p']).withMessage('Invalid resolution'),
    body('exportSettings.quality').isIn(['low', 'medium', 'high']).withMessage('Invalid quality'),
    body('exportSettings.fps').isInt({ min: 24, max: 60 }).withMessage('FPS must be between 24 and 60')
]

// Asset URL fetching
async function fetchAssetUrl(assetId: string, accessToken?: string): Promise<string> {
    try {
        console.log(`[Debug] Fetching asset URL for assetId: ${assetId}`)
        
        // Test GCS connectivity
        try {
            const bucket = storage.bucket(bucketName)
            console.log(`[Debug] Testing GCS bucket access: ${bucketName}`)
            const [bucketExists] = await bucket.exists()
            console.log(`[Debug] Bucket exists: ${bucketExists}`)
        } catch (bucketError) {
            console.error(`[Debug] GCS bucket access error:`, bucketError)
        }
        
        // First, fetch the asset from the database to get the object_key
        const { data: asset, error } = await supabase
            .from('assets')
            .select('object_key, name, mime_type, user_id')
            .eq('id', assetId)
            .single()

        if (error || !asset) {
            console.error(`[Debug] Asset ${assetId} not found in database:`, error)
            throw new Error(`Asset ${assetId} not found in database`)
        }

        console.log(`[Debug] Found asset in database:`, {
            assetId,
            object_key: asset.object_key,
            name: asset.name,
            mime_type: asset.mime_type,
            user_id: asset.user_id
        })

        // Generate signed URL using the object_key
        const bucket = storage.bucket(bucketName)
        const file = bucket.file(asset.object_key)
        
        // Check if file exists in Google Cloud Storage
        try {
            const [exists] = await file.exists()
            console.log(`[Debug] File exists in GCS: ${exists} for object_key: ${asset.object_key}`)
            
            if (!exists) {
                throw new Error(`File not found in Google Cloud Storage: ${asset.object_key}`)
            }
        } catch (existsError) {
            console.error(`[Debug] Error checking file existence:`, existsError)
            throw new Error(`Failed to verify file existence in storage: ${asset.object_key}`)
        }
        
        // Generate signed URL valid for 1 hour
        const [url] = await file.getSignedUrl({
            action: 'read',
            expires: Date.now() + 60 * 60 * 1000 // 1 hour
        })
        
        console.log(`[Debug] Generated signed URL for ${assetId}: ${url.substring(0, 100)}...`)
        
        return url
    } catch (error) {
        console.error(`[Debug] Failed to get URL for asset ${assetId}:`, error)
        throw new Error(`Asset ${assetId} not found: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
}

// Download asset to temp file
async function downloadAsset(url: string, filename: string): Promise<string> {
    try {
        console.log(`[Debug] Attempting to download asset from URL: ${url.substring(0, 100)}...`)
        console.log(`[Debug] Target filename: ${filename}`)
        
        const response = await fetch(url)
        console.log(`[Debug] Download response status: ${response.status} ${response.statusText}`)
        console.log(`[Debug] Download response headers:`, Object.fromEntries(response.headers.entries()))
        
        if (!response.ok) {
            throw new Error(`Failed to download asset: ${response.status} ${response.statusText}`)
        }
        
        const buffer = await response.arrayBuffer()
        console.log(`[Debug] Downloaded ${buffer.byteLength} bytes`)
        
        const filePath = path.join(TEMP_DIR, filename)
        await fs.writeFile(filePath, Buffer.from(buffer))
        
        console.log(`[Debug] Saved asset to: ${filePath}`)
        
        return filePath
    } catch (error) {
        console.error('[Debug] Download error details:', error)
        throw error
    }
}

// Process video export
async function processVideoExport(
    jobId: string,
    clips: TimelineClip[],
    tracks: TimelineTrack[],
    exportSettings: ExportSettings,
    accessToken?: string
): Promise<void> {
    const job = exportJobs.get(jobId)
    if (!job) return

    try {
        job.status = 'processing'
        job.progress = 5

        console.log(`[Export ${jobId}] Starting video export processing...`)

        // Calculate total timeline duration
        const allTimelineEnds = clips.map(c => c.timelineEndMs)
        const totalDurationMs = allTimelineEnds.length > 0 ? Math.max(...allTimelineEnds, 2000) : 2000
        const totalDurationSec = Math.ceil(totalDurationMs / 1000)

        // Get valid media clips
        const validMediaClips = clips.filter(clip => 
            (clip.type === 'video' || clip.type === 'image' || clip.type === 'audio') && clip.assetId
        )

        console.log(`[Export ${jobId}] Found ${validMediaClips.length} media clips, total duration: ${totalDurationSec}s`)
        
        // Log all clips for debugging
        console.log(`[Debug] All clips being processed:`)
        validMediaClips.forEach((clip, index) => {
            console.log(`[Debug] Clip ${index}:`, {
                id: clip.id,
                type: clip.type,
                assetId: clip.assetId,
                trackId: clip.trackId,
                hasExternalAsset: !!clip.properties?.externalAsset,
                externalAssetUrl: clip.properties?.externalAsset?.url
            })
        })

        // Download assets
        const downloadedAssets = new Map<string, string>()
        let downloadProgress = 0

        for (let i = 0; i < validMediaClips.length; i++) {
            const clip = validMediaClips[i]
            if (!clip.assetId) continue

            try {
                let assetUrl: string

                // Handle external assets
                if (clip.assetId.startsWith('external_')) {
                    const externalAsset = clip.properties?.externalAsset
                    if (!externalAsset || !externalAsset.url) {
                        throw new Error(`External asset ${clip.assetId} missing URL`)
                    }
                    assetUrl = externalAsset.url
                } else {
                    // Fetch regular asset URL
                    assetUrl = await fetchAssetUrl(clip.assetId, accessToken)
                }

                // Download asset
                const ext = path.extname(assetUrl.split('?')[0]) || '.mp4'
                const filename = `${jobId}_input_${i}${ext}`
                const filePath = await downloadAsset(assetUrl, filename)
                
                downloadedAssets.set(clip.assetId, filePath)
                downloadProgress = Math.round(((i + 1) / validMediaClips.length) * 30) // 5-35% for downloads
                job.progress = 5 + downloadProgress

                console.log(`[Export ${jobId}] Downloaded asset ${i + 1}/${validMediaClips.length}: ${clip.assetId}`)
            } catch (error) {
                console.error(`[Export ${jobId}] Failed to download asset ${clip.assetId}:`, error)
                throw new Error(`Failed to download asset ${clip.assetId}: ${error instanceof Error ? error.message : 'Unknown error'}`)
            }
        }

        job.progress = 35

        // Resolution settings
        const resolutionMap = {
            '480p': { width: 480, height: 854 },
            '720p': { width: 720, height: 1280 },
            '1080p': { width: 1080, height: 1920 }
        }

        const { width, height } = resolutionMap[exportSettings.resolution]
        const outputPath = path.join(EXPORTS_DIR, `${jobId}.mp4`)

        // Quality settings
        const crfMap = {
            low: 30,
            medium: 25,
            high: 20
        }

        const presetMap = {
            low: 'ultrafast',
            medium: 'medium',
            high: 'slow'
        }

        console.log(`[Export ${jobId}] Starting FFmpeg processing...`)

        // Create FFmpeg command
        const ffmpegCommand = ffmpeg()

        // Add inputs
        if (validMediaClips.length > 0) {
            validMediaClips.forEach((clip, index) => {
                if (clip.assetId && downloadedAssets.has(clip.assetId)) {
                    ffmpegCommand.input(downloadedAssets.get(clip.assetId)!)
                }
            })
        } else {
            // Create blank video if no clips
            ffmpegCommand.input(`color=c=black:s=${width}x${height}:r=${exportSettings.fps}`)
                       .inputFormat('lavfi')
                       .duration(totalDurationSec)
        }

        // Configure output
        ffmpegCommand
            .output(outputPath)
            .videoCodec('libx264')
            .audioCodec('aac')
            .size(`${width}x${height}`)
            .fps(exportSettings.fps)
            .videoBitrate('1000k')
            .audioBitrate('128k')
            .outputOptions([
                `-crf ${crfMap[exportSettings.quality]}`,
                `-preset ${exportSettings.quickExport ? 'ultrafast' : presetMap[exportSettings.quality]}`,
                '-pix_fmt yuv420p',
                '-movflags +faststart'
            ])

        // Process with progress tracking
        await new Promise<void>((resolve, reject) => {
            ffmpegCommand
                .on('start', (commandLine) => {
                    console.log(`[Export ${jobId}] FFmpeg command: ${commandLine}`)
                })
                .on('progress', (progress) => {
                    const percent = Math.min(Math.round(progress.percent || 0), 95)
                    job.progress = Math.max(35 + Math.round(percent * 0.6), job.progress) // 35-95%
                    console.log(`[Export ${jobId}] Processing: ${percent}%`)
                })
                .on('end', () => {
                    console.log(`[Export ${jobId}] FFmpeg processing completed`)
                    resolve()
                })
                .on('error', (error) => {
                    console.error(`[Export ${jobId}] FFmpeg error:`, error)
                    reject(error)
                })
                .run()
        })

        // Upload to Google Cloud Storage
        job.progress = 95
        console.log(`[Export ${jobId}] Uploading to cloud storage...`)

        const bucket = storage.bucket(bucketName)
        const cloudFileName = `exports/${jobId}.mp4`
        const file = bucket.file(cloudFileName)

        await bucket.upload(outputPath, {
            destination: cloudFileName,
            metadata: {
                contentType: 'video/mp4',
                metadata: {
                    exportSettings: JSON.stringify(exportSettings),
                    createdAt: new Date().toISOString()
                }
            }
        })

        // Generate signed download URL (valid for 24 hours)
        const [downloadUrl] = await file.getSignedUrl({
            action: 'read',
            expires: Date.now() + 24 * 60 * 60 * 1000
        })

        // Update job status
        job.status = 'completed'
        job.progress = 100
        job.outputPath = outputPath
        job.downloadUrl = downloadUrl
        job.completedAt = new Date()

        console.log(`[Export ${jobId}] Export completed successfully`)

        // Cleanup downloaded assets
        for (const filePath of downloadedAssets.values()) {
            try {
                await fs.unlink(filePath)
            } catch (error) {
                console.warn(`Failed to cleanup temp file ${filePath}:`, error)
            }
        }

    } catch (error) {
        console.error(`[Export ${jobId}] Export failed:`, error)
        job.status = 'failed'
        job.error = error instanceof Error ? error.message : 'Unknown error'

        // Cleanup on failure
        if (job.outputPath) {
            try {
                await fs.unlink(job.outputPath)
            } catch (cleanupError) {
                console.warn('Failed to cleanup output file:', cleanupError)
            }
        }
    }
}

// Routes

// Debug route - test asset fetching
router.get('/debug/asset/:assetId', async (req: Request, res: Response) => {
    try {
        const { assetId } = req.params
        console.log(`[Debug] Testing asset fetch for: ${assetId}`)
        
        const accessToken = req.headers.authorization?.replace('Bearer ', '')
        const url = await fetchAssetUrl(assetId, accessToken)
        
        res.json({
            success: true,
            assetId,
            url: url.substring(0, 100) + '...',
            message: 'Asset URL generated successfully'
        })
    } catch (error) {
        console.error(`[Debug] Asset test failed:`, error)
        res.status(404).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        })
    }
})

// Start export job
router.post('/start', validateExportRequest, async (req: Request, res: Response) => {
    try {
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() })
        }

        const { clips, tracks, exportSettings } = req.body
        const accessToken = req.headers.authorization?.replace('Bearer ', '')

        // Create job
        const jobId = uuid()
        const job: ExportJob = {
            id: jobId,
            status: 'queued',
            progress: 0,
            createdAt: new Date(),
            exportSettings
        }

        exportJobs.set(jobId, job)

        // Start processing in background
        processVideoExport(jobId, clips, tracks, exportSettings, accessToken)
            .catch(error => {
                console.error(`Background export failed for job ${jobId}:`, error)
            })

        res.json({
            success: true,
            jobId,
            message: 'Export job started'
        })

    } catch (error) {
        console.error('Export start error:', error)
        res.status(500).json({
            success: false,
            error: 'Failed to start export job'
        })
    }
})

// Check export status
router.get('/status/:jobId', (req, res) => {
    try {
        const { jobId } = req.params
        const job = exportJobs.get(jobId)

        if (!job) {
            return res.status(404).json({
                success: false,
                error: 'Export job not found'
            })
        }

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

    } catch (error) {
        console.error('Status check error:', error)
        res.status(500).json({
            success: false,
            error: 'Failed to check export status'
        })
    }
})

// Cancel export job
router.delete('/cancel/:jobId', (req, res) => {
    try {
        const { jobId } = req.params
        const job = exportJobs.get(jobId)

        if (!job) {
            return res.status(404).json({
                success: false,
                error: 'Export job not found'
            })
        }

        if (job.status === 'completed') {
            return res.status(400).json({
                success: false,
                error: 'Cannot cancel completed job'
            })
        }

        // Mark as failed to stop processing
        job.status = 'failed'
        job.error = 'Cancelled by user'

        res.json({
            success: true,
            message: 'Export job cancelled'
        })

    } catch (error) {
        console.error('Export cancel error:', error)
        res.status(500).json({
            success: false,
            error: 'Failed to cancel export job'
        })
    }
})

// List user's export jobs
router.get('/jobs', (req, res) => {
    try {
        const jobs = Array.from(exportJobs.values())
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, 10) // Return last 10 jobs

        res.json({
            success: true,
            jobs: jobs.map(job => ({
                id: job.id,
                status: job.status,
                progress: job.progress,
                error: job.error,
                downloadUrl: job.downloadUrl,
                createdAt: job.createdAt,
                completedAt: job.completedAt,
                exportSettings: job.exportSettings
            }))
        })

    } catch (error) {
        console.error('Jobs list error:', error)
        res.status(500).json({
            success: false,
            error: 'Failed to list export jobs'
        })
    }
})

export default router 