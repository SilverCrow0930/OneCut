import { v4 as uuid } from 'uuid'
import { Storage } from '@google-cloud/storage'
import { supabase } from '../config/supabaseClient.js'
import cron from 'node-cron'
import ffmpeg from 'fluent-ffmpeg'
import path from 'path'
import fs from 'fs/promises'
import os from 'os'
import { Server } from 'socket.io'

// Add global type declaration
declare global {
    var io: Server | undefined
}

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
    videoFormat: 'short' | 'long'
    targetDuration: number
    status: 'queued' | 'processing' | 'completed' | 'failed'
    progress: number
    message: string
    error?: string
    createdAt: Date
    userId: string
}

// Clip interface
interface ProcessedClip {
    id: string;
    title: string;
    description: string;
    start_time: number;
    end_time: number;
    duration: number;
    significance: number;
    narrative_role: string;
    transition_note: string;
    downloadUrl: string;
    previewUrl: string;
    thumbnailUrl: string;
    format: string;
    aspectRatio: string;
}

interface AIGeneratedClip {
    title: string;
    description: string;
    start_time: number;
    end_time: number;
    significance?: number;
    narrative_role?: string;
    transition_note?: string;
}

// FFmpeg progress interface
interface FFmpegProgress {
    frames: number;
    currentFps: number;
    currentKbps: number;
    targetSize: number;
    timemark: string;
    percent?: number;
}

// In-memory job queue (in production, use Redis or similar)
const jobQueue = new Map<string, QuickclipsJob>()
const activeJobs = new Set<string>()

// Content type configurations
const CONTENT_CONFIGS = {
    podcast: {
        name: 'Podcast',
        approach: 'Focus on key insights, compelling stories, emotional moments, and quotable statements that capture the essence of the conversation',
        characteristics: 'dialogue-driven, conversational flow, key ideas and revelations'
    },
    professional_meeting: {
        name: 'Professional Meeting', 
        approach: 'Extract decisions, action items, key discussions, and important announcements that represent the meeting\'s core outcomes',
        characteristics: 'business context, decisions, actionable information'
    },
    educational_video: {
        name: 'Educational Video',
        approach: 'Select clear explanations, demonstrations, key concepts, and learning moments that maintain educational continuity',
        characteristics: 'instructional flow, concept building, clear explanations'
    },
    talking_video: {
        name: 'Talking Video',
        approach: 'Choose meaningful statements, personal stories, insights, and expressive moments that convey the speaker\'s main message',
        characteristics: 'personal expression, key messages, emotional authenticity'
    }
}

// Video format configurations with flexible bounds
const FORMAT_CONFIGS = {
    short: {
        name: 'Short Format',
        aspectRatio: '9:16',
        maxDuration: 120, // < 2 minutes
        segmentCount: { min: 2, max: 10 },
        segmentLength: { min: 30, max: 90, target: 45 },
        totalDuration: { tolerance: 15 }, // ±15 seconds acceptable
        approach: 'Create a concise narrative arc with clear beginning, development, and conclusion. Each segment should build upon the previous one.'
    },
    long: {
        name: 'Long Format', 
        aspectRatio: '16:9',
        maxDuration: 1800, // 30 minutes
        segmentCount: { min: 2, max: 20 },
        segmentLength: null, // No strict length requirements - trust AI
        totalDuration: null, // No strict duration requirements - trust AI
        approach: 'Develop a comprehensive narrative that explores themes in depth while maintaining viewer engagement throughout. Segments will be combined into a single cohesive video. Focus on natural content breaks and meaningful storytelling.'
    }
}

// Dedicated AI function for QuickClips with improved narrative-focused prompt
async function generateQuickClips(signedUrl: string, mimeType: string, job: QuickclipsJob): Promise<any[]> {
    const { GoogleGenAI, createUserContent, createPartFromUri } = await import('@google/genai')
    
    const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY
    })
    
    // Handle custom content types with fallback
    const contentConfig = CONTENT_CONFIGS[job.contentType as keyof typeof CONTENT_CONFIGS] || {
        name: job.contentType,
        approach: `Focus on the most engaging and meaningful segments that capture the essence of this ${job.contentType} content`,
        characteristics: `content-specific elements, key messages, and engaging moments typical of ${job.contentType}`
    }
    const formatConfig = FORMAT_CONFIGS[job.videoFormat]
    
    const prompt = `You are an expert video editor trained to extract the most meaningful and coherent segments from long-form videos. Your goal is to select sequences that best represent the overall narrative, emotion, or information in the source material.

CONTENT TYPE: ${contentConfig.name}
EDITORIAL APPROACH: ${contentConfig.approach}
CONTENT CHARACTERISTICS: ${contentConfig.characteristics}

SEGMENT GUIDELINES:
- Target total duration: ~${job.targetDuration} seconds${formatConfig.totalDuration ? ` (±${formatConfig.totalDuration.tolerance}s)` : ' (flexible)'}
- For ${formatConfig.name}:
  * Number of segments: ${formatConfig.segmentCount.min}-${formatConfig.segmentCount.max} segments (choose what works best for the content)
  * Segment length: ${formatConfig.segmentLength ? `${formatConfig.segmentLength.target}s (${formatConfig.segmentLength.min}-${formatConfig.segmentLength.max}s)` : 'variable - based on natural content breaks'}
  * Aspect ratio: ${formatConfig.aspectRatio}
  * ${job.videoFormat === 'long' ? 'Segments will be combined into a single video' : 'Each segment will be a standalone clip'}
  * MINIMUM: Each segment must be at least 5 seconds (anything shorter will be filtered out)

${job.videoFormat === 'long' ? `
LONG FORMAT APPROACH:
- Focus on natural content breaks and meaningful story progression
- Each segment should represent a complete thought or topic
- Segments can vary in length based on content (anywhere from 30 seconds to several minutes)
- Prioritize narrative flow over exact timing constraints
- The combined video should tell a complete, engaging story
- Aim for approximately ${job.targetDuration} seconds total, but content quality is more important than exact timing
- Minimum 15 seconds per segment to ensure usability
` : `
SHORT FORMAT APPROACH:
- Target segments between ${formatConfig.segmentLength!.min} and ${formatConfig.segmentLength!.max} seconds (flexible - we'll accept what you generate)
- Target total duration ${job.targetDuration - formatConfig.totalDuration!.tolerance} to ${job.targetDuration + formatConfig.totalDuration!.tolerance} seconds (flexible)
- Focus on high-impact, standalone moments
- Minimum 5 seconds per segment to ensure usability
- Content quality is more important than exact timing
`}

DECISION PRIORITY:
1. ${job.videoFormat === 'long' ? 'Narrative coherence and natural story breaks' : 'Target duration compliance (STRICT)'}
2. ${job.videoFormat === 'long' ? 'Content completeness and meaningful segments' : 'Narrative coherence and natural story breaks'}
3. ${job.videoFormat === 'long' ? 'Approximate target duration' : 'Segment completeness (don\'t cut mid-thought)'}
4. Platform optimization

OUTPUT FORMAT:
Return ONLY a valid JSON array with NO additional text:

[
  {
    "title": "Opening Statement",
    "start_time": 15,
    "end_time": 65,
    "significance": 8.2,
    "description": "Speaker introduces main theme with personal anecdote",
    "narrative_role": "introduction",
    "transition_note": "Natural pause before topic shift"
  }
]

FIELD REQUIREMENTS:
- start_time, end_time: exact timestamps in seconds
- significance: 1-10 score based on importance to overall message
- narrative_role: introduction, development, climax, resolution, supporting
- transition_note: how this segment connects to the narrative flow
- NO overlapping timestamps
- Order segments chronologically (by start_time)

Remember: For ${formatConfig.name}, the goal is to create ${job.videoFormat === 'long' ? 'a single cohesive video' : 'standalone clips'} that ${contentConfig.approach}`

    try {
        // Download and upload file to Gemini
        const fileResponse = await fetch(signedUrl)
        if (!fileResponse.ok) {
            throw new Error(`Failed to download video: ${fileResponse.status}`)
        }
        
        const buffer = await fileResponse.arrayBuffer()
        const blob = new Blob([buffer], { type: mimeType })
        
        const uploadedFile = await ai.files.upload({
            file: blob,
            config: { mimeType }
        })
        
        if (!uploadedFile.name) {
            throw new Error('File upload failed - no file name returned')
        }
        
        // Wait for file processing
        let file = await ai.files.get({ name: uploadedFile.name })
        while (file.state === 'PROCESSING') {
            await new Promise(resolve => setTimeout(resolve, 2000))
            file = await ai.files.get({ name: uploadedFile.name })
        }
        
        if (file.state === 'FAILED') {
            throw new Error('File processing failed')
        }
        
        // Generate content
        const content = createUserContent([
            prompt,
            createPartFromUri(uploadedFile.uri || '', mimeType)
        ])
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash-exp',
            contents: [content],
            config: {
                maxOutputTokens: 4096,
                temperature: 0.2, // Lower temperature for more consistent, analytical responses
                topP: 0.8,
            }
        })
        
        const responseText = response.candidates?.[0]?.content?.parts?.[0]?.text || ''
        console.log(`[QuickClips] Raw AI response:`, responseText.substring(0, 500))
        
        // Parse JSON response with enhanced strategies
        let clips = []
        
        // Strategy 1: Direct JSON parse
        try {
            const cleanedResponse = responseText.trim()
            clips = JSON.parse(cleanedResponse)
        } catch (e) {
            console.log(`[QuickClips] Direct parse failed, trying extraction strategies...`)
            
            // Strategy 2: Extract JSON array with flexible patterns
            let jsonMatch = responseText.match(/\[\s*\{[\s\S]*?\}\s*\]/g)
            if (jsonMatch) {
                try {
                    clips = JSON.parse(jsonMatch[0])
                } catch (parseError) {
                    console.log(`[QuickClips] Array extraction failed, trying object collection...`)
                }
            }
            
            // Strategy 3: Look for individual complete JSON objects
            if (!clips.length) {
                const objectPattern = /\{\s*"title"[\s\S]*?"end_time"\s*:\s*\d+[\s\S]*?\}/g
                const objectMatches = responseText.match(objectPattern)
                
                if (objectMatches) {
                    clips = objectMatches.map(match => {
                        try {
                            return JSON.parse(match)
                        } catch (e) {
                            console.warn(`[QuickClips] Failed to parse object: ${match.substring(0, 100)}...`)
                            return null
                        }
                    }).filter(Boolean)
                }
            }
            
            // Strategy 4: Manual field extraction as last resort
            if (!clips.length) {
                console.log(`[QuickClips] Attempting manual field extraction...`)
                const titleMatches = responseText.match(/"title"\s*:\s*"([^"]+)"/g)
                const startMatches = responseText.match(/"start_time"\s*:\s*(\d+)/g)
                const endMatches = responseText.match(/"end_time"\s*:\s*(\d+)/g)
                const descMatches = responseText.match(/"description"\s*:\s*"([^"]+)"/g)
                
                if (titleMatches && startMatches && endMatches && titleMatches.length === startMatches.length) {
                    for (let i = 0; i < titleMatches.length; i++) {
                        const titleMatch = titleMatches[i].match(/"title"\s*:\s*"([^"]+)"/)
                        const startMatch = startMatches[i].match(/(\d+)/)
                        const endMatch = endMatches[i].match(/(\d+)/)
                        
                        if (titleMatch && startMatch && endMatch) {
                            clips.push({
                                title: titleMatch[1],
                                start_time: parseInt(startMatch[1]),
                                end_time: parseInt(endMatch[1]),
                                description: descMatches?.[i]?.match(/"description"\s*:\s*"([^"]+)"/)?.[1] || 'Generated clip',
                                significance: 8.0,
                                narrative_role: 'supporting',
                                transition_note: ''
                            })
                        }
                    }
                }
            }
            
            if (clips.length === 0) {
                throw new Error(`Failed to parse model output: No valid clips found in response. Response preview: ${responseText.substring(0, 200)}...`)
            }
        }
        
        // Validate and clean clips
        if (!Array.isArray(clips)) {
            throw new Error('Response is not an array')
        }
        
        clips = clips.filter(clip => {
            return clip && 
                   typeof clip.start_time === 'number' && 
                   typeof clip.end_time === 'number' &&
                   clip.start_time < clip.end_time &&
                   clip.title && 
                   clip.description
        }).map(clip => ({
            title: String(clip.title),
            start_time: Number(clip.start_time),
            end_time: Number(clip.end_time),
            significance: Number(clip.significance) || 7.0,
            description: String(clip.description),
            narrative_role: String(clip.narrative_role) || 'supporting',
            transition_note: String(clip.transition_note) || ''
        }))
        
        if (clips.length === 0) {
            throw new Error('No valid clips extracted')
        }

        // Filter out clips that are too short to be useful (under 5 seconds)
        const originalLength = clips.length
        clips = clips.filter(clip => {
            const duration = clip.end_time - clip.start_time
            if (duration < 5) {
                console.warn(`[QuickClips] Filtering out clip "${clip.title}" - too short (${duration}s)`)
                return false
            }
            return true
        })

        if (clips.length === 0) {
            throw new Error('All clips were too short (under 5 seconds)')
        }

        if (clips.length !== originalLength) {
            console.log(`[QuickClips] Filtered ${originalLength - clips.length} clips that were too short`)
        }
        
        // Sort chronologically
        clips.sort((a, b) => a.start_time - b.start_time)

        // Validate segment count
        if (clips.length < formatConfig.segmentCount.min || clips.length > formatConfig.segmentCount.max) {
            console.warn(`[QuickClips] Warning: ${clips.length} segments generated, expected ${formatConfig.segmentCount.min}-${formatConfig.segmentCount.max}. Continuing anyway.`)
        }

        // Validate segment lengths - only for short format (warn but don't fail)
        if (job.videoFormat === 'short' && formatConfig.segmentLength) {
            for (let i = 0; i < clips.length; i++) {
                const clip = clips[i]
                const duration = clip.end_time - clip.start_time
                if (duration < formatConfig.segmentLength.min || duration > formatConfig.segmentLength.max) {
                    console.warn(`[QuickClips] Warning: Segment ${i+1} duration ${duration}s is outside expected range ${formatConfig.segmentLength.min}-${formatConfig.segmentLength.max}s. Continuing anyway.`)
                }
            }
        }

        // Calculate total duration and validate against target - only for short format (warn but don't fail)
        const totalDuration = clips.reduce((acc, clip) => acc + (clip.end_time - clip.start_time), 0)
        
        if (job.videoFormat === 'short' && formatConfig.totalDuration) {
            const targetWithTolerance = {
                min: job.targetDuration - formatConfig.totalDuration.tolerance,
                max: job.targetDuration + formatConfig.totalDuration.tolerance
            }

            if (totalDuration < targetWithTolerance.min || totalDuration > targetWithTolerance.max) {
                console.warn(`[QuickClips] Warning: Total duration ${totalDuration}s is outside target range ${targetWithTolerance.min}-${targetWithTolerance.max}s. Continuing anyway.`)
            }
        }

        console.log(`[QuickClips] Successfully extracted ${clips.length} ${job.videoFormat === 'long' ? 'segments for combination' : 'narrative segments'} with total duration ${totalDuration}s`)

        return clips
        
    } catch (error) {
        console.error('[QuickClips] AI generation failed:', error)
        throw error
    }
}

// Generate video description using AI
async function generateVideoDescription(signedUrl: string, mimeType: string, job: QuickclipsJob, clips: any[]): Promise<string> {
    const { GoogleGenAI, createUserContent, createPartFromUri } = await import('@google/genai')
    
    const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY
    })
    
    // Handle custom content types with fallback
    const contentConfig = CONTENT_CONFIGS[job.contentType as keyof typeof CONTENT_CONFIGS] || {
        name: job.contentType,
        approach: `Focus on the most engaging and meaningful segments that capture the essence of this ${job.contentType} content`,
        characteristics: `content-specific elements, key messages, and engaging moments typical of ${job.contentType}`
    }
    const formatConfig = FORMAT_CONFIGS[job.videoFormat]
    
    const clipSummary = clips.map(clip => `- ${clip.title}: ${clip.description} (${clip.start_time}s-${clip.end_time}s)`).join('\n')
    
    const prompt = `You are an expert content analyzer. Based on the video content and the key segments extracted, write a compelling description for this video.

CONTENT TYPE: ${contentConfig.name}
VIDEO FORMAT: ${formatConfig.name} (${formatConfig.aspectRatio})
CONTENT CHARACTERISTICS: ${contentConfig.characteristics}

EXTRACTED SEGMENTS:
${clipSummary}

TASK: Write a 2-3 sentence description that:
1. Captures the main theme or message of the video
2. Highlights what makes it valuable to viewers
3. Uses engaging language appropriate for the content type
4. Mentions key topics or insights covered

The description should be concise but compelling, making someone want to watch the clips.

Return ONLY the description text, no extra formatting or quotes.`

    try {
        // Download and upload file to Gemini
        const fileResponse = await fetch(signedUrl)
        if (!fileResponse.ok) {
            throw new Error(`Failed to download video: ${fileResponse.status}`)
        }
        
        const buffer = await fileResponse.arrayBuffer()
        const blob = new Blob([buffer], { type: mimeType })
        
        const uploadedFile = await ai.files.upload({
            file: blob,
            config: { mimeType }
        })
        
        if (!uploadedFile.name) {
            throw new Error('File upload failed - no file name returned')
        }
        
        // Wait for file processing
        let file = await ai.files.get({ name: uploadedFile.name })
        while (file.state === 'PROCESSING') {
            await new Promise(resolve => setTimeout(resolve, 2000))
            file = await ai.files.get({ name: uploadedFile.name })
        }
        
        if (file.state === 'FAILED') {
            throw new Error('File processing failed')
        }
        
        // Generate content
        const content = createUserContent([
            prompt,
            createPartFromUri(uploadedFile.uri || '', mimeType)
        ])
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash-exp',
            contents: [content],
            config: {
                maxOutputTokens: 200,
                temperature: 0.7,
                topP: 0.9,
            }
        })
        
        const description = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''
        
        if (!description) {
            // Fallback description based on clips
            const mainTopics = clips.slice(0, 3).map(c => c.title).join(', ')
            return `This ${contentConfig.name.toLowerCase()} covers ${mainTopics} and other key insights in ${clips.length} highlight segments.`
        }
        
        return description
        
    } catch (error) {
        console.error('[QuickClips] Video description generation failed:', error)
        
        // Fallback description
        const mainTopics = clips.slice(0, 3).map(c => c.title).join(', ')
        return `This ${contentConfig.name.toLowerCase()} covers ${mainTopics} and other key insights in ${clips.length} highlight segments.`
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
        
        // Get socket instance
        const io = global.io
        if (!io) {
            console.warn('[QuickclipsProcessor] Socket.io instance not found')
        }
        
        // Helper function to emit state updates
        const emitState = (state: string, message: string, progress: number) => {
            if (io) {
                io.emit('quickclips_state', {
                    state,
                    message,
                    progress
                })
            }
        }
        
        // Update status to processing
        job.status = 'processing'
        job.progress = 10
        job.message = 'Analyzing video content and structure...'
        
        await updateProjectStatus(job.projectId, {
            processing_status: 'processing',
            processing_progress: 10,
            processing_message: job.message
        })
        emitState('analyzing', job.message, 10)
        
        // Step 1: Verify file exists in GCS
        const objectKey = job.fileUri.replace('gs://lemona-edit-assets/', '')
        const file = bucket.file(objectKey)
        const [exists] = await file.exists()
        
        if (!exists) {
            throw new Error(`File not found in GCS: ${objectKey}`)
        }
        
        // Step 2: Generate signed URL for AI processing
        const [signedUrl] = await bucket
            .file(objectKey)
            .getSignedUrl({
                action: 'read',
                expires: Date.now() + 4 * 60 * 60 * 1000, // 4 hours
            })
        
        job.progress = 30
        job.message = 'AI is identifying key narrative segments...'
        await updateProjectStatus(job.projectId, {
            processing_progress: 30,
            processing_message: job.message
        })
        emitState('generating', job.message, 30)
        
        // Step 3: Generate clips using dedicated AI function
        const clips = await generateQuickClips(signedUrl, job.mimeType, job)
        
        job.progress = 60
        job.message = 'Generating video description...'
        await updateProjectStatus(job.projectId, {
            processing_progress: 60,
            processing_message: job.message
        })
        emitState('processing', job.message, 60)
        
        // Step 4: Generate video description
        const videoDescription = await generateVideoDescription(signedUrl, job.mimeType, job, clips)
        
        job.progress = 75
        job.message = 'Extracting video segments...'
        await updateProjectStatus(job.projectId, {
            processing_progress: 75,
            processing_message: job.message
        })
        emitState('processing', job.message, 75)
        
        // Step 5: Process video clips (extract segments)
        const processedClips = await extractVideoClips(signedUrl, clips, job)
        
        job.progress = 95
        job.message = 'Finalizing clips...'
        await updateProjectStatus(job.projectId, {
            processing_progress: 95,
            processing_message: job.message
        })
        emitState('finalizing', job.message, 95)
        
        // Step 6: Complete job
        job.status = 'completed'
        job.progress = 100
        job.message = 'Narrative highlights extracted successfully!'
        
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
                contentType: job.contentType,
                approach: 'narrative_coherence',
                description: videoDescription
            },
            processing_completed_at: completedAt
        })
        
        // Emit completion state and response
        emitState('completed', job.message, 100)
        if (io) {
            io.emit('quickclips_response', {
                success: true,
                clips: processedClips,
                processingTime: Date.now() - job.createdAt.getTime()
            })
        }
        
        console.log(`[QuickclipsProcessor] Job ${job.id} completed successfully with ${processedClips.length} narrative segments`)
        
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
        
        // Emit error state
        if (global.io) {
            global.io.emit('quickclips_state', {
                state: 'error',
                message: job.message,
                progress: 0
            })
            global.io.emit('quickclips_response', {
                success: false,
                error: job.error
            })
        }
    }
}

// Extract video clips using FFmpeg
async function extractVideoClips(videoUrl: string, clips: AIGeneratedClip[], job: QuickclipsJob): Promise<ProcessedClip[]> {
    const processedClips: ProcessedClip[] = []
    const tempDir = os.tmpdir()
    
    // Verify URL is still valid
    try {
        const response = await fetch(videoUrl, { method: 'HEAD' })
        if (!response.ok) {
            throw new Error('Source video URL is no longer valid')
        }
    } catch (error) {
        console.error('[QuickclipsProcessor] Source URL validation failed:', error)
        throw new Error('Could not access source video')
    }

    // For long format, we'll combine all segments into one video
    if (job.videoFormat === 'long') {
        try {
            // First extract all segments
            const segmentFiles: string[] = []
            const segmentList = path.join(tempDir, `segments_${job.id}.txt`)

            for (let i = 0; i < clips.length; i++) {
                const clip = clips[i]
                const clipDuration = clip.end_time - clip.start_time
                
                // Extract segment
                const segmentPath = path.join(tempDir, `segment_${job.id}_${i}.mp4`)
                segmentFiles.push(segmentPath)

                await new Promise<void>((resolve, reject) => {
                    ffmpeg(videoUrl)
                        .seekInput(clip.start_time)
                        .duration(clipDuration)
                        .output(segmentPath)
                        .videoCodec('libx264')
                        .audioCodec('aac')
                        .outputOptions([
                            '-pix_fmt yuv420p',
                            '-preset fast',
                            '-movflags +faststart',
                            '-profile:v main',
                            '-crf 23',
                            '-maxrate 4M',
                            '-bufsize 8M',
                            '-r 30',
                            '-g 60'
                        ])
                        .size('1920x1080')
                        .autopad()
                        .on('end', () => resolve())
                        .on('error', (err) => reject(err))
                        .run()
                })
            }

            // Create concat file
            const concatContent = segmentFiles.map(f => `file '${f}'`).join('\n')
            await fs.writeFile(segmentList, concatContent)

            // Combine all segments
            const outputPath = path.join(tempDir, `combined_${job.id}.mp4`)
            await new Promise<void>((resolve, reject) => {
                ffmpeg()
                    .input(segmentList)
                    .inputOptions(['-f concat', '-safe 0'])
                    .output(outputPath)
                    .outputOptions([
                        '-c copy',
                        '-movflags +faststart'
                    ])
                    .on('end', () => resolve())
                    .on('error', (err) => reject(err))
                    .run()
            })

            // Upload combined video
            const clipFileName = `clips/${job.projectId}/long_${Date.now()}.mp4`
            await bucket.upload(outputPath, {
                destination: clipFileName,
                metadata: {
                    contentType: 'video/mp4',
                    cacheControl: 'public, max-age=31536000'
                }
            })

            // Generate signed URL
            const [downloadUrl] = await bucket.file(clipFileName).getSignedUrl({
                action: 'read',
                expires: Date.now() + 7 * 24 * 60 * 60 * 1000
            })

            // Generate thumbnail
            const thumbnailPath = path.join(tempDir, `thumb_${job.id}.jpg`)
            await new Promise<void>((resolve, reject) => {
                ffmpeg(outputPath)
                    .screenshots({
                        timestamps: ['1'],
                        filename: path.basename(thumbnailPath),
                        folder: path.dirname(thumbnailPath),
                        size: '640x360'
                    })
                    .on('end', () => resolve())
                    .on('error', (err) => reject(err))
            })

            // Upload thumbnail
            const thumbFileName = `clips/${job.projectId}/thumb_${Date.now()}.jpg`
            await bucket.upload(thumbnailPath, {
                destination: thumbFileName,
                metadata: {
                    contentType: 'image/jpeg',
                    cacheControl: 'public, max-age=31536000'
                }
            })

            const [thumbnailUrl] = await bucket.file(thumbFileName).getSignedUrl({
                action: 'read',
                expires: Date.now() + 7 * 24 * 60 * 60 * 1000
            })

            // Calculate total duration
            const totalDuration = clips.reduce((acc, clip) => acc + (clip.end_time - clip.start_time), 0)

            // Add combined clip to results
            processedClips.push({
                id: `long_${job.id}`,
                title: 'Combined Long-Form Video',
                description: clips.map(c => c.title).join(' → '),
                start_time: clips[0].start_time,
                end_time: clips[clips.length - 1].end_time,
                duration: totalDuration,
                significance: 9.0,
                narrative_role: 'complete',
                transition_note: 'Combined segments for long-form viewing',
                downloadUrl,
                previewUrl: downloadUrl,
                thumbnailUrl,
                format: job.videoFormat,
                aspectRatio: FORMAT_CONFIGS[job.videoFormat].aspectRatio
            })

            // Cleanup
            await Promise.all([
                ...segmentFiles.map(f => fs.unlink(f)),
                fs.unlink(segmentList),
                fs.unlink(outputPath),
                fs.unlink(thumbnailPath)
            ].map(p => p.catch(e => console.warn('Cleanup error:', e))))

        } catch (error) {
            console.error('[QuickclipsProcessor] Failed to combine segments:', error)
            throw error
        }
    } else {
        // Original short-format processing
        for (let i = 0; i < clips.length; i++) {
            const clip = clips[i]
            
            // Validate clip timing
            if (typeof clip.start_time !== 'number' || typeof clip.end_time !== 'number') {
                throw new Error(`Invalid clip timing for clip ${i}`)
            }
            
            const clipDuration = clip.end_time - clip.start_time
            if (clipDuration <= 0) {
                throw new Error(`Invalid clip duration for clip ${i}: ${clipDuration}s`)
            }
            
            try {
                // Create temporary output file
                const outputPath = path.join(tempDir, `clip_${job.id}_${i}.mp4`)
                
                // Use FFmpeg to extract clip with proper encoding settings
                await new Promise<void>((resolve, reject) => {
                    ffmpeg(videoUrl)
                        .seekInput(clip.start_time)
                        .duration(clipDuration)
                        .output(outputPath)
                        .videoCodec('libx264')
                        .audioCodec('aac')
                        .outputOptions([
                            '-pix_fmt yuv420p',
                            '-preset fast',
                            '-movflags +faststart',
                            '-profile:v main',
                            '-crf 23',
                            '-maxrate 4M',
                            '-bufsize 8M',
                            '-r 30',
                            '-g 60'
                        ])
                        .size('720x1280')
                        .autopad()
                        .on('start', (command) => {
                            console.log(`[QuickclipsProcessor] FFmpeg command for clip ${i}:`, command)
                        })
                        .on('progress', (progress: FFmpegProgress) => {
                            const percent = progress.percent ?? 0
                            console.log(`[QuickclipsProcessor] Processing clip ${i}: ${Math.round(percent)}%`)
                        })
                        .on('end', () => resolve())
                        .on('error', (err) => reject(err))
                        .run()
                })
                
                // Verify the output file exists and has content
                const stats = await fs.stat(outputPath)
                if (stats.size === 0) {
                    throw new Error('Generated clip is empty')
                }

                // Upload clip to GCS
                const clipFileName = `clips/${job.projectId}/clip_${i}_${Date.now()}.mp4`
                await bucket.upload(outputPath, {
                    destination: clipFileName,
                    metadata: {
                        contentType: 'video/mp4',
                        cacheControl: 'public, max-age=31536000'
                    }
                })
                
                // Generate signed URL for download
                const [downloadUrl] = await bucket.file(clipFileName).getSignedUrl({
                    action: 'read',
                    expires: Date.now() + 7 * 24 * 60 * 60 * 1000
                })
                
                // Generate thumbnail
                const thumbnailPath = path.join(tempDir, `thumb_${job.id}_${i}.jpg`)
                await new Promise<void>((resolve, reject) => {
                    ffmpeg(outputPath)
                        .screenshots({
                            timestamps: ['1'],
                            filename: path.basename(thumbnailPath),
                            folder: path.dirname(thumbnailPath),
                            size: '640x360'
                        })
                        .on('end', () => resolve())
                        .on('error', (err) => reject(err))
                })
                
                // Upload thumbnail
                const thumbFileName = `clips/${job.projectId}/thumb_${i}_${Date.now()}.jpg`
                await bucket.upload(thumbnailPath, {
                    destination: thumbFileName,
                    metadata: {
                        contentType: 'image/jpeg',
                        cacheControl: 'public, max-age=31536000'
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
                    duration: clipDuration,
                    significance: clip.significance || 7.0,
                    narrative_role: clip.narrative_role || 'supporting',
                    transition_note: clip.transition_note || '',
                    downloadUrl,
                    previewUrl: downloadUrl,
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
                throw clipError
            }
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