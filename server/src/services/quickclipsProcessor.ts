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
    userPrompt?: string // Optional user prompt for custom instructions
    status: 'queued' | 'processing' | 'completed' | 'failed'
    progress: number
    message: string
    error?: string
    createdAt: Date
    userId: string
    isEditorMode: boolean
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

// Video format configurations with flexible bounds
const FORMAT_CONFIGS = {
    short: {
        name: 'Individual Clips',
        maxDuration: 120, // < 2 minutes per clip
        segmentCount: { min: 1, max: 20 }, // Generate multiple individual clips
        segmentLength: { min: 15, max: 120, target: 45 }, // Each clip should be 15-120 seconds
        totalDuration: { tolerance: 30 }, // ±30 seconds acceptable for total duration
        approach: 'Create multiple individual video clips, each under 2 minutes. Each clip should be standalone and capture a complete thought or moment.'
    },
    long: {
        name: 'Combined Video', 
        maxDuration: 1800, // 30 minutes total
        segmentCount: { min: 2, max: 15 }, // Generate multiple segments to combine
        segmentLength: { min: 30, max: 300 }, // Each segment 30s-5min, will be combined
        totalDuration: { tolerance: 60 }, // ±60 seconds acceptable for final combined duration
        approach: 'Create multiple segments that will be combined into one video. Focus on natural content breaks and smooth transitions between segments.'
    }
}

// Helper function to get transcription from audio
async function getTranscriptionFromAudio(audioUrl: string, mimeType: string): Promise<string> {
    try {
        const { GoogleGenAI, createUserContent, createPartFromUri } = await import('@google/genai')
        
        const ai = new GoogleGenAI({
            apiKey: process.env.GEMINI_API_KEY
        })
        
        // Upload audio file to Gemini
        const fileResponse = await fetch(audioUrl)
        if (!fileResponse.ok) {
            throw new Error(`Failed to download audio for transcription: ${fileResponse.status}`)
        }
        
        const buffer = await fileResponse.arrayBuffer()
        const blob = new Blob([buffer], { type: mimeType })
        
        const uploadedFile = await ai.files.upload({
            file: blob,
            config: { mimeType }
        })
        
        if (!uploadedFile.name) {
            throw new Error('Audio file upload for transcription failed')
        }
        
        // Wait for file processing
        let file = await ai.files.get({ name: uploadedFile.name })
        while (file.state === 'PROCESSING') {
            await new Promise(resolve => setTimeout(resolve, 2000))
            file = await ai.files.get({ name: uploadedFile.name })
        }
        
        if (file.state === 'FAILED') {
            throw new Error('Audio file processing for transcription failed')
        }
        
        // Generate transcription
        const transcriptionPrompt = `Please provide a clean, accurate transcription of this audio. Include natural speech patterns, pauses (indicated by ... or [pause]), and speaker changes if multiple speakers. Format as readable text with proper punctuation.`
        
        const content = createUserContent([
            transcriptionPrompt,
            createPartFromUri(uploadedFile.uri || '', mimeType)
        ])
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [content],
            config: {
                maxOutputTokens: 8192,
                temperature: 0.1,
                topP: 0.8,
            }
        })
        
        const transcript = response.candidates?.[0]?.content?.parts?.[0]?.text || ''
        console.log(`📝 Transcription completed: ${transcript.length} characters`)
        
        return transcript
        
    } catch (error) {
        console.error('Transcription failed, proceeding without transcript:', error)
        return 'Transcription unavailable - proceeding with audio-only analysis.'
    }
}

// Dedicated AI function for QuickClips with improved narrative-focused prompt
async function generateQuickClips(signedUrl: string, mimeType: string, job: QuickclipsJob): Promise<{ clips: any[], transcript?: string }> {
    // Route to appropriate processing method based on content type
    if (job.contentType === 'talking_video') {
        console.log(`[QuickClips] Using audio-only processing for cost optimization (95% savings)`)
        return generateQuickClipsFromAudio(signedUrl, mimeType, job)
    } else {
        console.log(`[QuickClips] Using full video+audio processing for visual content`)
        const clips = await generateQuickClipsFromVideo(signedUrl, mimeType, job)
        return { clips }
    }
}

// Audio-only processing for Talk & Audio content (95% cost savings)
async function generateQuickClipsFromAudio(signedUrl: string, mimeType: string, job: QuickclipsJob): Promise<{ clips: any[], transcript: string }> {
    const { GoogleGenAI, createUserContent, createPartFromUri } = await import('@google/genai')
    
    if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY environment variable is not set')
    }
    
    const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY
    })
    
    console.log(`[QuickClips Audio] Gemini API key configured: ${process.env.GEMINI_API_KEY ? 'Yes' : 'No'}`)
    
    const formatConfig = FORMAT_CONFIGS[job.videoFormat]
    
    // Extract audio from video for cost optimization (same logic as transcription service)
    let audioUrl = signedUrl
    let audioMimeType = mimeType
    let tempAudioFile: string | null = null
    
    if (mimeType.startsWith('video/')) {
        console.log('🎵 Extracting audio from video for cost-optimized processing...')
        
        try {
            const tempDir = os.tmpdir()
            const inputFileName = `input_${Date.now()}_${Math.random().toString(36).substring(7)}.${mimeType.split('/')[1]}`
            const outputFileName = `audio_${Date.now()}_${Math.random().toString(36).substring(7)}.mp3`
            const inputPath = path.join(tempDir, inputFileName)
            const outputPath = path.join(tempDir, outputFileName)
            
            // Download video file
            const videoResponse = await fetch(signedUrl)
            if (!videoResponse.ok) {
                throw new Error(`Failed to download video: ${videoResponse.status}`)
            }
            
            const videoBuffer = await videoResponse.arrayBuffer()
            await fs.writeFile(inputPath, Buffer.from(videoBuffer))
            
            // Extract audio using FFmpeg
            await new Promise<void>((resolve, reject) => {
                ffmpeg(inputPath)
                    .toFormat('mp3')
                    .audioCodec('libmp3lame')
                    .audioChannels(1) // Mono for smaller file size
                    .audioFrequency(22050) // Lower frequency for analysis (sufficient quality)
                    .audioBitrate('64k') // Lower bitrate for cost optimization
                    .on('end', () => {
                        console.log('✅ Audio extraction completed')
                        resolve()
                    })
                    .on('error', (err) => {
                        console.error('❌ FFmpeg audio extraction failed:', err)
                        reject(new Error(`Audio extraction failed: ${err.message}`))
                    })
                    .save(outputPath)
            })
            
            // Upload extracted audio to temporary GCS location
            const audioBuffer = await fs.readFile(outputPath)
            const tempAudioKey = `temp/quickclips_audio_${Date.now()}_${Math.random().toString(36).substring(7)}.mp3`
            
            const file = bucket.file(tempAudioKey)
            await file.save(audioBuffer, {
                metadata: {
                    contentType: 'audio/mpeg',
                },
            })
            
            // Generate signed URL for the audio file
            const [audioSignedUrl] = await file.getSignedUrl({
                action: 'read',
                expires: Date.now() + 60 * 60 * 1000, // 1 hour
            })
            
            audioUrl = audioSignedUrl
            audioMimeType = 'audio/mpeg'
            tempAudioFile = tempAudioKey
            
            // Clean up local temp files
            await fs.unlink(inputPath).catch(console.error)
            await fs.unlink(outputPath).catch(console.error)
            
            console.log('🎵 Audio extraction completed - processing with 95% cost savings!')
            
        } catch (audioError) {
            console.error('Audio extraction failed, falling back to full video:', audioError)
            // Fall back to original video file if audio extraction fails
            audioUrl = signedUrl
            audioMimeType = mimeType
        }
    }
    
    // Single AI call for both transcription and segmentation to avoid confusion
    console.log('🎯 Analyzing audio for Smart Cut segments...')
    
    const userInstructions = job.userPrompt ? `\n\nUSER INSTRUCTIONS: ${job.userPrompt}\nPlease incorporate these specific requirements into your analysis while maintaining the core quality standards.` : ''
    
    const prompt = `You are an expert audio editor. Your task is to analyze this audio content and extract the most meaningful segments with precise timestamps.

TASK: Analyze the audio and identify the best segments for ${formatConfig.name.toLowerCase()}.

FORMAT REQUIREMENTS:
${job.videoFormat === 'short' ? `
SHORT FORMAT (Individual Clips):
- Create ${formatConfig.segmentCount.min}-${formatConfig.segmentCount.max} individual clips
- Each clip should be ${formatConfig.segmentLength!.min}-${formatConfig.segmentLength!.max} seconds long (target: ${(formatConfig.segmentLength as any)?.target || 45}s)
- Total duration target: ~${job.targetDuration} seconds (±${formatConfig.totalDuration!.tolerance}s acceptable)
- Each clip must be standalone and complete
- Focus on high-impact moments, key insights, quotable statements
` : `
LONG FORMAT (Combined Video):
- Create ${formatConfig.segmentCount.min}-${formatConfig.segmentCount.max} segments that will be combined
- Each segment should be ${formatConfig.segmentLength!.min}-${formatConfig.segmentLength!.max} seconds long
- Total combined duration target: ~${job.targetDuration} seconds (±${formatConfig.totalDuration!.tolerance}s acceptable)
- Segments should flow together naturally when combined
- Focus on narrative progression and topic development
`}

ANALYSIS APPROACH:
1. Listen to the entire audio content
2. Identify key topics, insights, and compelling moments
3. Find natural speech breaks and topic transitions
4. Select segments with clear beginnings and endings
5. Ensure no overlapping timestamps
6. Prioritize content quality over exact timing

MINIMUM REQUIREMENTS:
- Each segment must be at least 3 seconds long
- Timestamps must be precise (in seconds)
- No overlapping segments
- Chronological order (by start_time)

OUTPUT FORMAT:
Return ONLY a valid JSON array with NO additional text, explanations, or markdown:

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

CRITICAL: Your response must start with [ and end with ]. Include nothing else.

FIELD REQUIREMENTS:
- start_time, end_time: exact timestamps in seconds (required)
- title: descriptive name for the segment (required)
- description: what happens in this segment (required)
- significance: 1-10 score based on importance (required)
- narrative_role: introduction, development, climax, resolution, supporting (required)
- transition_note: how this connects to the flow (required)

${userInstructions}`

    try {
        console.log(`[QuickClips Audio] Starting AI analysis...`)
        console.log(`[QuickClips Audio] Audio URL: ${audioUrl.substring(0, 100)}...`)
        console.log(`[QuickClips Audio] Audio MIME type: ${audioMimeType}`)
        
        // Upload audio file to Gemini
        console.log(`[QuickClips Audio] Downloading audio file...`)
        const fileResponse = await fetch(audioUrl)
        if (!fileResponse.ok) {
            throw new Error(`Failed to download audio: ${fileResponse.status} ${fileResponse.statusText}`)
        }
        
        const buffer = await fileResponse.arrayBuffer()
        const blob = new Blob([buffer], { type: audioMimeType })
        console.log(`[QuickClips Audio] Audio file downloaded: ${buffer.byteLength} bytes`)
        
        console.log(`[QuickClips Audio] Uploading to Gemini...`)
        const uploadedFile = await ai.files.upload({
            file: blob,
            config: { mimeType: audioMimeType }
        })
        
        if (!uploadedFile.name) {
            throw new Error('Audio file upload failed - no file name returned')
        }
        console.log(`[QuickClips Audio] File uploaded to Gemini: ${uploadedFile.name}`)
        
        // Wait for file processing
        console.log(`[QuickClips Audio] Waiting for file processing...`)
        let file = await ai.files.get({ name: uploadedFile.name })
        let attempts = 0
        while (file.state === 'PROCESSING' && attempts < 30) {
            console.log(`[QuickClips Audio] File processing... (attempt ${attempts + 1})`)
            await new Promise(resolve => setTimeout(resolve, 2000))
            file = await ai.files.get({ name: uploadedFile.name })
            attempts++
        }
        
        if (file.state === 'FAILED') {
            throw new Error('Audio file processing failed')
        }
        
        if (file.state === 'PROCESSING') {
            throw new Error('Audio file processing timed out after 60 seconds')
        }
        
        console.log(`[QuickClips Audio] File processed successfully: ${file.state}`)
        
        // Generate content using audio-only analysis
        console.log(`[QuickClips Audio] Creating AI request...`)
        console.log(`[QuickClips Audio] Prompt length: ${prompt.length} characters`)
        
        const content = createUserContent([
            prompt,
            createPartFromUri(uploadedFile.uri || '', audioMimeType)
        ])
        
        console.log(`[QuickClips Audio] Sending request to Gemini...`)
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [content],
            config: {
                maxOutputTokens: 4096,
                temperature: 0.2,
                topP: 0.8,
            }
        })
        
        console.log(`[QuickClips Audio] Received response from Gemini`)
        console.log(`[QuickClips Audio] Response object:`, JSON.stringify(response, null, 2))
        
        const responseText = response.candidates?.[0]?.content?.parts?.[0]?.text || ''
        console.log(`[QuickClips Audio] Raw AI response (length: ${responseText.length}):`)
        console.log(responseText)
        
        // Parse JSON response with robust error handling
        let clips = []
        try {
            const cleanedResponse = responseText.trim()
            clips = JSON.parse(cleanedResponse)
        } catch (e) {
            console.log(`[QuickClips Audio] Direct parse failed, trying extraction strategies...`)
            
            // Strategy 1: Extract JSON array (most common)
            let jsonMatch = responseText.match(/\[\s*\{[\s\S]*?\}\s*\]/g)
            if (jsonMatch) {
                try {
                    clips = JSON.parse(jsonMatch[0])
                    console.log(`[QuickClips Audio] Successfully parsed JSON array`)
                } catch (parseError) {
                    console.log(`[QuickClips Audio] Array extraction failed:`, parseError instanceof Error ? parseError.message : parseError)
                }
            }
            
            // Strategy 2: Extract from markdown code blocks
            if (!clips.length) {
                const codeBlockMatch = responseText.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/g)
                if (codeBlockMatch) {
                    try {
                        const jsonContent = codeBlockMatch[0].replace(/```(?:json)?\s*/, '').replace(/\s*```/, '')
                        clips = JSON.parse(jsonContent)
                        console.log(`[QuickClips Audio] Successfully parsed from code block`)
                    } catch (parseError) {
                        console.log(`[QuickClips Audio] Code block extraction failed:`, parseError instanceof Error ? parseError.message : parseError)
                    }
                }
            }
            
            // Strategy 3: Extract individual JSON objects
            if (!clips.length) {
                const objectPattern = /\{\s*"title"[\s\S]*?"end_time"\s*:\s*\d+[\s\S]*?\}/g
                const objectMatches = responseText.match(objectPattern)
                
                if (objectMatches) {
                    clips = objectMatches.map(match => {
                        try {
                            return JSON.parse(match)
                        } catch (e) {
                            return null
                        }
                    }).filter(Boolean)
                    
                    if (clips.length > 0) {
                        console.log(`[QuickClips Audio] Successfully parsed ${clips.length} individual objects`)
                    }
                }
            }
            
            // Strategy 4: Look for any array-like structure
            if (!clips.length) {
                const arrayPattern = /\[[\s\S]*?\]/g
                const arrayMatches = responseText.match(arrayPattern)
                
                if (arrayMatches) {
                    for (const match of arrayMatches) {
                        try {
                            const parsed = JSON.parse(match)
                            if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].title) {
                                clips = parsed
                                console.log(`[QuickClips Audio] Successfully parsed array structure`)
                                break
                            }
                        } catch (e) {
                            // Continue to next match
                        }
                    }
                }
            }
            
            if (clips.length === 0) {
                console.error(`[QuickClips Audio] PARSING FAILED - Full AI response:`)
                console.error(`Response length: ${responseText.length} characters`)
                console.error(`Response content:`)
                console.error(responseText)
                console.error(`[QuickClips Audio] End of failed response`)
                throw new Error(`Failed to parse audio analysis output. Response format not recognized.`)
            }
        }
        
        // Validate and clean clips
        if (!Array.isArray(clips)) {
            throw new Error('Audio analysis response is not an array')
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
            throw new Error('No valid audio clips found after filtering')
        }

        // Filter out clips that are too short to be useful (under 3 seconds)
        const originalLength = clips.length
        clips = clips.filter(clip => {
            const duration = clip.end_time - clip.start_time
            if (duration < 3) {
                console.warn(`[QuickClips Audio] Filtering out clip "${clip.title}" - too short (${duration}s)`)
                return false
            }
            return true
        })

        if (clips.length === 0) {
            throw new Error('All audio clips were too short (under 3 seconds)')
        }

        if (clips.length !== originalLength) {
            console.log(`[QuickClips Audio] Filtered ${originalLength - clips.length} clips that were too short`)
        }
        
        // Sort chronologically
        clips.sort((a, b) => a.start_time - b.start_time)
        
        // Clean up temporary audio file
        if (tempAudioFile) {
            setTimeout(async () => {
                try {
                    await bucket.file(tempAudioFile!).delete()
                    console.log('🗑️ Cleaned up temporary audio file from GCS')
                } catch (error) {
                    console.error('Failed to clean up temp audio file:', error)
                }
            }, 2 * 60 * 60 * 1000) // 2 hours
        }
        
        console.log(`[QuickClips Audio] Generated ${clips.length} audio-optimized clips`)
        return { clips, transcript: 'Transcript generated during analysis' }
        
    } catch (error) {
        console.error(`[QuickClips Audio] Audio processing failed:`, error)
        
        // Log specific error details
        if (error instanceof Error) {
            console.error(`[QuickClips Audio] Error name: ${error.name}`)
            console.error(`[QuickClips Audio] Error message: ${error.message}`)
            console.error(`[QuickClips Audio] Error stack:`, error.stack)
        }
        
        // Check if it's a Gemini API error
        if (error && typeof error === 'object' && 'status' in error) {
            console.error(`[QuickClips Audio] API Error status:`, (error as any).status)
            console.error(`[QuickClips Audio] API Error details:`, (error as any).message || (error as any).details)
        }
        
        // Check for network errors
        if (error instanceof TypeError && error.message.includes('fetch')) {
            console.error(`[QuickClips Audio] Network error - check internet connection and API endpoints`)
        }
        
        // Clean up temporary audio file on error
        if (tempAudioFile) {
            try {
                await bucket.file(tempAudioFile).delete()
            } catch (cleanupError) {
                console.error('Failed to clean up temp audio file on error:', cleanupError)
            }
        }
        
        throw error
    }
}

// Original video+audio processing for Action & Visual content
async function generateQuickClipsFromVideo(signedUrl: string, mimeType: string, job: QuickclipsJob): Promise<any[]> {
    const { GoogleGenAI, createUserContent, createPartFromUri } = await import('@google/genai')
    
    const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY
    })
    
    const formatConfig = FORMAT_CONFIGS[job.videoFormat]
    
    const userInstructions = job.userPrompt ? `\n\nUSER INSTRUCTIONS: ${job.userPrompt}\nPlease incorporate these specific requirements into your analysis while maintaining the core quality standards.` : ''
    
    const prompt = `You are an expert video editor trained to extract the most meaningful and coherent segments from long-form videos. Your goal is to select sequences that best represent the overall narrative, emotion, or information in the source material.

EDITORIAL APPROACH: Focus on the most engaging and meaningful segments that capture the essence of the video content. Look for key insights, compelling stories, emotional moments, clear explanations, and quotable statements.

SEGMENT GUIDELINES:
- Target total duration: ~${job.targetDuration} seconds${formatConfig.totalDuration ? ` (±${formatConfig.totalDuration.tolerance}s)` : ' (flexible)'}
- For ${formatConfig.name}:
  * Number of segments: ${formatConfig.segmentCount.min}-${formatConfig.segmentCount.max} segments (choose what works best for the content)
  * Segment length: ${formatConfig.segmentLength ? `${(formatConfig.segmentLength as any)?.target || 45}s (${formatConfig.segmentLength.min}-${formatConfig.segmentLength.max}s)` : 'variable - based on natural content breaks'}
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

Remember: For ${formatConfig.name}, the goal is to create ${job.videoFormat === 'long' ? 'a single cohesive video' : 'standalone clips'} that capture the most engaging and meaningful content from the source material.${userInstructions}`

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
            model: 'gemini-2.5-flash',
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

        // Filter out clips that are too short to be useful (under 3 seconds)
        const originalLength = clips.length
        clips = clips.filter(clip => {
            const duration = clip.end_time - clip.start_time
            if (duration < 3) {
                console.warn(`[QuickClips] Filtering out clip "${clip.title}" - too short (${duration}s)`)
                return false
            }
            return true
        })

        if (clips.length === 0) {
            throw new Error('All clips were too short (under 3 seconds)')
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

        console.log(`[QuickClips Video] Successfully extracted ${clips.length} ${job.videoFormat === 'long' ? 'segments for combination' : 'narrative segments'} with total duration ${totalDuration}s`)

        return clips
        
    } catch (error) {
        console.error('[QuickClips Video] AI generation failed:', error)
        throw error
    }
}

// Generate video description using AI
async function generateVideoDescription(signedUrl: string, mimeType: string, job: QuickclipsJob, clips: any[]): Promise<string> {
    const { GoogleGenAI, createUserContent, createPartFromUri } = await import('@google/genai')
    
    const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY
    })
    
    const formatConfig = FORMAT_CONFIGS[job.videoFormat]
    
    const clipSummary = clips.map(clip => `- ${clip.title}: ${clip.description} (${clip.start_time}s-${clip.end_time}s)`).join('\n')
    
    const prompt = `You are an expert content analyzer. Based on the video content and the key segments extracted, write a compelling description for this video.

VIDEO FORMAT: ${formatConfig.name}

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
            model: 'gemini-2.5-flash',
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
            return `This ${formatConfig.name.toLowerCase()} covers ${mainTopics} and other key insights in ${clips.length} highlight segments.`
        }
        
        return description
        
    } catch (error) {
        console.error('[QuickClips] Video description generation failed:', error)
        
        // Fallback description
        const mainTopics = clips.slice(0, 3).map(c => c.title).join(', ')
        return `This ${formatConfig.name.toLowerCase()} covers ${mainTopics} and other key insights in ${clips.length} highlight segments.`
    }
}

// Add job to queue
export async function queueQuickclipsJob(
    projectId: string,
    fileUri: string,
    mimeType: string,
    contentType: string,
    targetDuration: number,
    userId: string,
    isEditorMode: boolean = false,
    userPrompt?: string
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
        userPrompt,
        status: 'queued',
        progress: 0,
        message: 'Queued for processing...',
        createdAt: new Date(),
        userId,
        isEditorMode
    }
    
    jobQueue.set(jobId, job)
    
    // Update project status in database (only for standalone Smart Cut projects, not editor mode)
    if (!isEditorMode) {
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
    }
    
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
        
        if (!job.isEditorMode) {
        await updateProjectStatus(job.projectId, {
            processing_status: 'processing',
            processing_progress: 10,
            processing_message: job.message
        })
        }
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
        if (!job.isEditorMode) {
        await updateProjectStatus(job.projectId, {
            processing_progress: 30,
            processing_message: job.message
        })
        }
        emitState('generating', job.message, 30)
        
        // Step 3: Generate clips using dedicated AI function
        const result = await generateQuickClips(signedUrl, job.mimeType, job)
        const clips = result.clips
        const transcript = result.transcript
        
        job.progress = 60
        job.message = 'Generating video description...'
        if (!job.isEditorMode) {
        await updateProjectStatus(job.projectId, {
            processing_progress: 60,
            processing_message: job.message
        })
        }
        emitState('processing', job.message, 60)
        
        // Step 4: Generate video description
        const videoDescription = await generateVideoDescription(signedUrl, job.mimeType, job, clips)
        
        job.progress = 75
        job.message = 'Extracting video segments...'
        if (!job.isEditorMode) {
        await updateProjectStatus(job.projectId, {
            processing_progress: 75,
            processing_message: job.message
        })
        }
        emitState('processing', job.message, 75)
        
        // Step 5: Process video clips (extract segments)
        const processedClips = await extractVideoClips(signedUrl, clips, job)
        
        job.progress = 95
        job.message = 'Finalizing clips...'
        if (!job.isEditorMode) {
        await updateProjectStatus(job.projectId, {
            processing_progress: 95,
            processing_message: job.message
        })
        }
        emitState('finalizing', job.message, 95)
        
        // Step 6: Complete job
        job.status = 'completed'
        job.progress = 100
        job.message = 'Narrative highlights extracted successfully!'
        
        const completedAt = new Date().toISOString()
        
        if (!job.isEditorMode) {
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
                    description: videoDescription,
                    ...(transcript && { transcript })
            },
            processing_completed_at: completedAt
        })
        }
        
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
        
        if (!job.isEditorMode) {
        await updateProjectStatus(job.projectId, {
            processing_status: 'failed',
            processing_error: job.error,
            processing_message: job.message,
            processing_completed_at: new Date().toISOString()
        })
        }
        
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

                // Use robust approach for long format segments
                let segmentSuccess = false
                let lastError: Error | null = null
                
                // Attempt 1: Simple video extraction (preserves original aspect ratio)
                try {
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
                                '-avoid_negative_ts make_zero'
                            ])
                            .on('end', () => resolve())
                            .on('error', (err) => reject(err))
                            .run()
                    })
                    segmentSuccess = true
                    console.log(`[QuickclipsProcessor] Long format segment ${i} processed with simple approach (original aspect ratio preserved)`)
                } catch (error) {
                    lastError = error as Error
                    console.warn(`[QuickclipsProcessor] Long format segment ${i} simple processing failed, trying audio-only approach: ${lastError.message}`)
                }
                
                // Attempt 2: Fallback to audio-only with original aspect ratio black background
                if (!segmentSuccess) {
                    try {
                        // First, get the original video dimensions
                        const videoInfo = await new Promise<{ width: number, height: number }>((resolve, reject) => {
                            ffmpeg.ffprobe(videoUrl, (err, metadata) => {
                                if (err) {
                                    reject(err)
                                    return
                                }
                                
                                const videoStream = metadata.streams.find(stream => stream.codec_type === 'video')
                                if (!videoStream || !videoStream.width || !videoStream.height) {
                                    reject(new Error('Could not determine video dimensions'))
                                    return
                                }
                                
                                resolve({
                                    width: videoStream.width,
                                    height: videoStream.height
                                })
                            })
                        })
                        
                        await new Promise<void>((resolve, reject) => {
                            ffmpeg()
                                .input(videoUrl)
                                .seekInput(clip.start_time)
                                .duration(clipDuration)
                                .input(`color=c=black:s=${videoInfo.width}x${videoInfo.height}:r=30`)
                                .inputFormat('lavfi')
                                .output(segmentPath)
                                .videoCodec('libx264')
                                .audioCodec('aac')
                                .outputOptions([
                                    '-pix_fmt yuv420p',
                                    '-preset fast',
                                    '-movflags +faststart',
                                    '-profile:v main',
                                    '-crf 23',
                                    '-map 0:a', // Audio from original file
                                    '-map 1:v', // Video from black background with original dimensions
                                    '-shortest'
                                ])
                                .on('end', () => resolve())
                                .on('error', (err) => reject(err))
                                .run()
                        })
                        segmentSuccess = true
                        console.log(`[QuickclipsProcessor] Long format segment ${i} processed with audio-only approach (${videoInfo.width}x${videoInfo.height} preserved)`)
                    } catch (audioError) {
                        console.error(`[QuickclipsProcessor] All processing methods failed for long format segment ${i}:`, audioError)
                        throw new Error(`Failed to process segment ${i}: ${lastError?.message || 'Unknown error'} (also tried audio-only: ${(audioError as Error).message})`)
                    }
                }
                
                if (!segmentSuccess) {
                    throw new Error(`Failed to process segment ${i} for long format`)
                }
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
                format: job.videoFormat
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
        // Original short-format processing (now preserves original aspect ratio)
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
                
                // Use FFmpeg to extract clip with robust approach
                let success = false
                let lastError: Error | null = null
                
                // Attempt 1: Simple video extraction (preserves original aspect ratio)
                try {
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
                                '-avoid_negative_ts make_zero'  // Handle timing issues
                            ])
                            .on('start', (command) => {
                                console.log(`[QuickclipsProcessor] Simple FFmpeg command for clip ${i}:`, command)
                            })
                            .on('progress', (progress: FFmpegProgress) => {
                                const percent = progress.percent ?? 0
                                console.log(`[QuickclipsProcessor] Processing clip ${i}: ${Math.round(percent)}%`)
                            })
                            .on('end', () => resolve())
                            .on('error', (err) => reject(err))
                            .run()
                    })
                    success = true
                    console.log(`[QuickclipsProcessor] Successfully processed clip ${i} with simple approach (original aspect ratio preserved)`)
                } catch (error) {
                    lastError = error as Error
                    console.warn(`[QuickclipsProcessor] Simple video processing failed for clip ${i}, trying audio-only approach: ${lastError.message}`)
                }
                
                // Attempt 2: If video processing failed, try audio-only with original aspect ratio black background
                if (!success) {
                    try {
                        // First, get the original video dimensions
                        const videoInfo = await new Promise<{ width: number, height: number }>((resolve, reject) => {
                            ffmpeg.ffprobe(videoUrl, (err, metadata) => {
                                if (err) {
                                    reject(err)
                                    return
                                }
                                
                                const videoStream = metadata.streams.find(stream => stream.codec_type === 'video')
                                if (!videoStream || !videoStream.width || !videoStream.height) {
                                    reject(new Error('Could not determine video dimensions'))
                                    return
                                }
                                
                                resolve({
                                    width: videoStream.width,
                                    height: videoStream.height
                                })
                            })
                        })
                        
                        await new Promise<void>((resolve, reject) => {
                            ffmpeg()
                                .input(videoUrl)
                                .seekInput(clip.start_time)
                                .duration(clipDuration)
                                .input(`color=c=black:s=${videoInfo.width}x${videoInfo.height}:r=30`)
                                .inputFormat('lavfi')
                                .output(outputPath)
                                .videoCodec('libx264')
                                .audioCodec('aac')
                                .outputOptions([
                                    '-pix_fmt yuv420p',
                                    '-preset fast',
                                    '-movflags +faststart',
                                    '-profile:v main',
                                    '-crf 23',
                                    '-map 0:a', // Audio from first input (original file)
                                    '-map 1:v', // Video from second input (black background with original dimensions)
                                    '-shortest'  // Match shortest input duration
                                ])
                                .on('start', (command) => {
                                    console.log(`[QuickclipsProcessor] Audio-with-original-dimensions FFmpeg command for clip ${i}:`, command)
                                })
                                .on('progress', (progress: FFmpegProgress) => {
                                    const percent = progress.percent ?? 0
                                    console.log(`[QuickclipsProcessor] Processing audio-only clip ${i}: ${Math.round(percent)}%`)
                                })
                                .on('end', () => resolve())
                                .on('error', (err) => reject(err))
                                .run()
                        })
                        success = true
                        console.log(`[QuickclipsProcessor] Successfully processed clip ${i} with audio-only approach (${videoInfo.width}x${videoInfo.height} preserved)`)
                    } catch (audioError) {
                        console.error(`[QuickclipsProcessor] All processing methods failed for clip ${i}:`, audioError)
                        throw new Error(`Failed to process clip ${i}: ${lastError?.message || 'Unknown error'} (also tried audio-only: ${(audioError as Error).message})`)
                    }
                }
                
                if (!success) {
                    throw new Error(`Failed to process clip ${i} after trying multiple approaches`)
                }
                
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
                    format: job.videoFormat
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