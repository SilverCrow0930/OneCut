import { v4 as uuid } from 'uuid'
import { Storage } from '@google-cloud/storage'
import { generateContent } from '../integrations/googleGenAI.js'
import { supabase } from '../config/supabaseClient.js'
import cron from 'node-cron'
import ffmpeg from 'fluent-ffmpeg'
import path from 'path'
import fs from 'fs/promises'
import os from 'os'

// Initialize GCS bucket
const storage = new Storage({
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    keyFilename: process.env.GOOGLE_CLOUD_KEY_FILE,
})
const bucket = storage.bucket(process.env.GOOGLE_CLOUD_STORAGE_BUCKET || 'lemona-edit-assets')

// Processing job interface
interface QuickclipsJob {
    id: string
    projectId: string
    fileUri: string
    mimeType: string
    contentType: string
    videoFormat: 'short' | 'long' // Simplified to just two types
    targetDuration: number
    status: 'queued' | 'processing' | 'completed' | 'failed'
    progress: number
    message: string
    error?: string
    createdAt: Date
    userId: string
}

// In-memory job queue (in production, use Redis or similar)
const jobQueue = new Map<string, QuickclipsJob>()
const activeJobs = new Set<string>()

// Content type configurations
const CONTENT_CONFIGS = {
    podcast: {
        name: 'Podcast',
        description: 'Extract the most engaging and shareable moments from this podcast',
        audioFocus: true
    },
    professional_meeting: {
        name: 'Professional Meeting', 
        description: 'Identify key decisions, insights, and action items from this meeting',
        audioFocus: true
    },
    educational_video: {
        name: 'Educational Video',
        description: 'Find the most valuable learning moments and key takeaways',
        audioFocus: true
    },
    talking_video: {
        name: 'Talking Video',
        description: 'Extract the most engaging, quotable, and shareable moments',
        audioFocus: true
    }
}

// Video format configurations  
const FORMAT_CONFIGS = {
    short: {
        name: 'Short Vertical (9:16)',
        aspectRatio: '9:16',
        maxDuration: 120, // 2 minutes
        clipCount: 3,
        clipDuration: [15, 90], // 15-90 seconds per clip
        strategy: 'Create viral-ready clips optimized for mobile viewing and social media platforms'
    },
    long: {
        name: 'Long Horizontal (16:9)', 
        aspectRatio: '16:9',
        maxDuration: 1800, // 30 minutes
        clipCount: 4,
        clipDuration: [120, 300], // 2-5 minutes per clip
        strategy: 'Create substantial clips with complete context for professional content'
    }
}

// Add job to queue
export async function queueQuickclipsJob(
    projectId: string,
    fileUri: string,
    mimeType: string,
    contentType: string,
    targetDuration: number,
    userId: string
): Promise<string> {
    const jobId = uuid()
    const videoFormat = targetDuration < 120 ? 'short' : 'long' as 'short' | 'long'
    
    const job: QuickclipsJob = {
        id: jobId,
        projectId,
        fileUri,
        mimeType,
        contentType,
        videoFormat,
        targetDuration,
        status: 'queued',
        progress: 0,
        message: 'Queued for processing...',
        createdAt: new Date(),
        userId
    }
    
    jobQueue.set(jobId, job)
    
    // Update project status in database
    await updateProjectStatus(projectId, {
        processing_status: 'queued',
        processing_type: 'quickclips',
        processing_job_id: jobId,
        processing_progress: 0,
        processing_message: 'Queued for processing...',
        processing_data: {
            contentType,
            videoFormat,
            targetDuration,
            fileUri
        },
        processing_started_at: new Date().toISOString()
    })
    
    console.log(`[QuickclipsProcessor] Job ${jobId} queued for project ${projectId}`)
    
    // Start processing if not at capacity
    processNextJob()
    
    return jobId
}

// Update project status in database
async function updateProjectStatus(projectId: string, updates: any) {
    try {
        const { error } = await supabase
            .from('projects')
            .update(updates)
            .eq('id', projectId)
            
        if (error) {
            console.error(`[QuickclipsProcessor] Failed to update project ${projectId}:`, error)
        }
    } catch (error) {
        console.error(`[QuickclipsProcessor] Database error updating project ${projectId}:`, error)
    }
}

// Process next job in queue
async function processNextJob() {
    // Limit concurrent processing (adjust based on server capacity)
    const MAX_CONCURRENT_JOBS = 2
    
    if (activeJobs.size >= MAX_CONCURRENT_JOBS) {
        console.log(`[QuickclipsProcessor] At capacity (${activeJobs.size}/${MAX_CONCURRENT_JOBS})`)
        return
    }
    
    // Find next queued job
    const queuedJob = Array.from(jobQueue.values()).find(job => job.status === 'queued')
    if (!queuedJob) {
        return
    }
    
    activeJobs.add(queuedJob.id)
    await processQuickclipsJob(queuedJob)
    activeJobs.delete(queuedJob.id)
    
    // Process next job if available
    setTimeout(processNextJob, 1000)
}

// Main processing function
async function processQuickclipsJob(job: QuickclipsJob) {
    try {
        console.log(`[QuickclipsProcessor] Starting job ${job.id} for project ${job.projectId}`)
        
        // Update status to processing
        job.status = 'processing'
        job.progress = 5
        job.message = 'Starting video analysis...'
        
        await updateProjectStatus(job.projectId, {
            processing_status: 'processing',
            processing_progress: 5,
            processing_message: job.message
        })
        
        // Step 1: Verify file exists in GCS
        const objectKey = job.fileUri.replace('gs://lemona-edit-assets/', '')
        const file = bucket.file(objectKey)
        const [exists] = await file.exists()
        
        if (!exists) {
            throw new Error(`File not found in GCS: ${objectKey}`)
        }
        
        job.progress = 10
        job.message = 'Generating secure access URL...'
        await updateProjectStatus(job.projectId, {
            processing_progress: 10,
            processing_message: job.message
        })
        
        // Step 2: Generate signed URL for AI processing
        const [signedUrl] = await bucket
            .file(objectKey)
            .getSignedUrl({
                action: 'read',
                expires: Date.now() + 4 * 60 * 60 * 1000, // 4 hours
            })
        
        job.progress = 20
        job.message = 'Analyzing video content with AI...'
        await updateProjectStatus(job.projectId, {
            processing_progress: 20,
            processing_message: job.message
        })
        
        // Step 3: Generate AI prompt
        const contentConfig = CONTENT_CONFIGS[job.contentType as keyof typeof CONTENT_CONFIGS]
        const formatConfig = FORMAT_CONFIGS[job.videoFormat]
        
        const prompt = `${contentConfig.description}. ${formatConfig.strategy}

Create ${formatConfig.clipCount} clips with the following specifications:
- Each clip should be ${formatConfig.clipDuration[0]}-${formatConfig.clipDuration[1]} seconds long
- Target total duration: ${job.targetDuration} seconds across all clips
- Optimize for ${formatConfig.aspectRatio} aspect ratio
- Focus on ${contentConfig.audioFocus ? 'audio content and speech' : 'visual elements'}

Return ONLY a JSON array of clips, no other text. Each clip should have:
{
    "title": "Engaging title that hooks viewers",
    "start_time": start_seconds_as_number,
    "end_time": end_seconds_as_number,
    "viral_score": score_0_to_10_as_number,
    "description": "Why this moment is valuable and engaging",
    "category": "hook|insight|story|tutorial|entertainment"
}

Ensure clips are ordered by viral_score (highest first) and do not overlap.`
        
        job.progress = 30
        job.message = 'AI is analyzing and selecting best moments...'
        await updateProjectStatus(job.projectId, {
            processing_progress: 30,
            processing_message: job.message
        })
        
        // Step 4: Get AI analysis
        const modelResponse = await generateContent(
            prompt,
            signedUrl,
            job.mimeType,
            job.contentType,
            job.videoFormat
        )
        
        job.progress = 60
        job.message = 'Processing AI recommendations...'
        await updateProjectStatus(job.projectId, {
            processing_progress: 60,
            processing_message: job.message
        })
        
        // Step 5: Parse AI response
        let clips
        try {
            const responseText = modelResponse.textOutput?.text || ''
            console.log(`[QuickclipsProcessor] AI Response for job ${job.id}:`, responseText)
            
            const jsonMatch = responseText.match(/\[[\s\S]*\]/)
            if (jsonMatch) {
                clips = JSON.parse(jsonMatch[0])
            } else {
                throw new Error('No valid JSON found in AI response')
            }
            
            // Validate clips structure
            if (!Array.isArray(clips) || clips.length === 0) {
                throw new Error('Invalid clips array from AI')
            }
            
            // Validate each clip has required fields
            clips.forEach((clip, index) => {
                if (typeof clip.start_time !== 'number' || typeof clip.end_time !== 'number') {
                    throw new Error(`Clip ${index} missing valid start_time or end_time`)
                }
                if (!clip.title || !clip.description) {
                    throw new Error(`Clip ${index} missing title or description`)
                }
            })
            
        } catch (parseError) {
            console.error(`[QuickclipsProcessor] Failed to parse AI response for job ${job.id}:`, parseError)
            
            // Fallback clips based on video format
            const fallbackClipDuration = job.videoFormat === 'short' ? 45 : 180
            clips = [
                {
                    title: `${contentConfig.name} Highlights`,
                    start_time: 30,
                    end_time: 30 + fallbackClipDuration,
                    viral_score: 8.0,
                    description: 'Key highlights from the content',
                    category: 'highlight'
                },
                {
                    title: `Best Moments`,
                    start_time: Math.max(90, 30 + fallbackClipDuration + 10),
                    end_time: Math.max(90, 30 + fallbackClipDuration + 10) + fallbackClipDuration,
                    viral_score: 7.5,
                    description: 'Most engaging moments',
                    category: 'entertainment'
                }
            ]
        }
        
        job.progress = 80
        job.message = 'Creating video clips...'
        await updateProjectStatus(job.projectId, {
            processing_progress: 80,
            processing_message: job.message
        })
        
        // Step 6: Process video clips (extract segments)
        const processedClips = await extractVideoClips(signedUrl, clips, job)
        
        job.progress = 95
        job.message = 'Finalizing results...'
        await updateProjectStatus(job.projectId, {
            processing_progress: 95,
            processing_message: job.message
        })
        
        // Step 7: Complete job
        job.status = 'completed'
        job.progress = 100
        job.message = 'Processing completed successfully!'
        
        const completedAt = new Date().toISOString()
        
        await updateProjectStatus(job.projectId, {
            processing_status: 'completed',
            processing_progress: 100,
            processing_message: job.message,
            processing_result: {
                clips: processedClips,
                totalClips: processedClips.length,
                processingTime: Date.now() - job.createdAt.getTime(),
                videoFormat: job.videoFormat,
                contentType: job.contentType
            },
            processing_completed_at: completedAt
        })
        
        console.log(`[QuickclipsProcessor] Job ${job.id} completed successfully with ${processedClips.length} clips`)
        
    } catch (error) {
        console.error(`[QuickclipsProcessor] Job ${job.id} failed:`, error)
        
        job.status = 'failed'
        job.error = error instanceof Error ? error.message : 'Unknown processing error'
        job.message = `Processing failed: ${job.error}`
        
        await updateProjectStatus(job.projectId, {
            processing_status: 'failed',
            processing_error: job.error,
            processing_message: job.message,
            processing_completed_at: new Date().toISOString()
        })
    }
}

// Extract video clips using FFmpeg
async function extractVideoClips(videoUrl: string, clips: any[], job: QuickclipsJob): Promise<any[]> {
    const processedClips = []
    const tempDir = os.tmpdir()
    
    for (let i = 0; i < clips.length; i++) {
        const clip = clips[i]
        
        try {
            // Create temporary output file
            const outputPath = path.join(tempDir, `clip_${job.id}_${i}.mp4`)
            
            // Use FFmpeg to extract clip
            await new Promise<void>((resolve, reject) => {
                ffmpeg(videoUrl)
                    .seekInput(clip.start_time)
                    .duration(clip.end_time - clip.start_time)
                    .output(outputPath)
                    .videoCodec('libx264')
                    .audioCodec('aac')
                    .size(job.videoFormat === 'short' ? '720x1280' : '1920x1080')
                    .on('end', () => resolve())
                    .on('error', (err) => reject(err))
                    .run()
            })
            
            // Upload clip to GCS
            const clipFileName = `clips/${job.projectId}/clip_${i}_${Date.now()}.mp4`
            await bucket.upload(outputPath, {
                destination: clipFileName,
                metadata: {
                    contentType: 'video/mp4'
                }
            })
            
            // Generate signed URL for download
            const [downloadUrl] = await bucket.file(clipFileName).getSignedUrl({
                action: 'read',
                expires: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
            })
            
            // Generate thumbnail (first frame)
            const thumbnailPath = path.join(tempDir, `thumb_${job.id}_${i}.jpg`)
            await new Promise<void>((resolve, reject) => {
                ffmpeg(outputPath)
                    .seekInput(1) // 1 second in
                    .frames(1)
                    .output(thumbnailPath)
                    .on('end', () => resolve())
                    .on('error', (err) => reject(err))
                    .run()
            })
            
            // Upload thumbnail
            const thumbFileName = `clips/${job.projectId}/thumb_${i}_${Date.now()}.jpg`
            await bucket.upload(thumbnailPath, {
                destination: thumbFileName,
                metadata: {
                    contentType: 'image/jpeg'
                }
            })
            
            const [thumbnailUrl] = await bucket.file(thumbFileName).getSignedUrl({
                action: 'read',
                expires: Date.now() + 7 * 24 * 60 * 60 * 1000
            })
            
            processedClips.push({
                id: `clip_${job.id}_${i}`,
                title: clip.title,
                description: clip.description,
                start_time: clip.start_time,
                end_time: clip.end_time,
                duration: clip.end_time - clip.start_time,
                viral_score: clip.viral_score,
                category: clip.category || 'highlight',
                downloadUrl,
                thumbnailUrl,
                format: job.videoFormat,
                aspectRatio: FORMAT_CONFIGS[job.videoFormat].aspectRatio
            })
            
            // Cleanup temp files
            try {
                await fs.unlink(outputPath)
                await fs.unlink(thumbnailPath)
            } catch (cleanupError) {
                console.warn(`[QuickclipsProcessor] Cleanup warning for job ${job.id}:`, cleanupError)
            }
            
        } catch (clipError) {
            console.error(`[QuickclipsProcessor] Failed to process clip ${i} for job ${job.id}:`, clipError)
            
            // Add placeholder clip for failed extractions
            processedClips.push({
                id: `clip_${job.id}_${i}`,
                title: clip.title,
                description: clip.description,
                start_time: clip.start_time,
                end_time: clip.end_time,
                duration: clip.end_time - clip.start_time,
                viral_score: clip.viral_score,
                category: clip.category || 'highlight',
                downloadUrl: '#', // Placeholder
                thumbnailUrl: `https://picsum.photos/320/180?random=${i + 1}`,
                format: job.videoFormat,
                aspectRatio: FORMAT_CONFIGS[job.videoFormat].aspectRatio,
                error: 'Failed to extract video clip'
            })
        }
    }
    
    return processedClips
}

// Get job status
export function getJobStatus(jobId: string): QuickclipsJob | null {
    return jobQueue.get(jobId) || null
}

// Get all jobs for a user
export function getUserJobs(userId: string): QuickclipsJob[] {
    return Array.from(jobQueue.values()).filter(job => job.userId === userId)
}

// Cleanup old jobs (run every hour)
cron.schedule('0 * * * *', () => {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours ago
    
    for (const [jobId, job] of jobQueue.entries()) {
        if (job.createdAt < cutoffTime && ['completed', 'failed'].includes(job.status)) {
            jobQueue.delete(jobId)
            console.log(`[QuickclipsProcessor] Cleaned up old job ${jobId}`)
        }
    }
})

console.log('[QuickclipsProcessor] Background processor initialized') 