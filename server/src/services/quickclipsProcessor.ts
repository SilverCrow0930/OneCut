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
        name: 'Short Format',
        maxDuration: 120, // < 2 minutes
        segmentCount: { min: 2, max: 14 },
        segmentLength: { min: 30, max: 90, target: 45 },
        totalDuration: { tolerance: 15 }, // ±15 seconds acceptable
        approach: 'Create a concise narrative arc with clear beginning, development, and conclusion. Each segment should build upon the previous one.'
    },
    long: {
        name: 'Long Format', 
        maxDuration: 1800, // 30 minutes
        segmentCount: { min: 2, max: 20 },
        segmentLength: null, // No strict length requirements - trust AI
        totalDuration: null, // No strict duration requirements - trust AI
        approach: 'Develop a comprehensive narrative that explores themes in depth while maintaining viewer engagement throughout. Segments will be combined into a single cohesive video. Focus on natural content breaks and meaningful storytelling.'
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
            model: 'gemini-2.0-flash-exp',
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
    
    const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY
    })
    
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
    
    // Step 1: Get transcript for better analysis quality
    console.log('📝 Getting transcript for enhanced audio analysis...')
    const transcript = await getTranscriptionFromAudio(audioUrl, audioMimeType)
    
    const userInstructions = job.userPrompt ? `\n\nUSER INSTRUCTIONS: ${job.userPrompt}\nPlease incorporate these specific requirements into your analysis while maintaining the core quality standards.` : ''
    
    const prompt = `You are an expert audio editor trained to extract the most meaningful and coherent segments from audio content. Your goal is to identify speech-driven segments that capture key insights, compelling stories, emotional moments, and quotable statements.

CRITICAL: You MUST return ONLY a valid JSON array. Do not include any other text, markdown formatting, or explanations. The response should start with '[' and end with ']'.

TRANSCRIPTION-ENHANCED APPROACH: You have access to both the audio file and its transcript. Use the transcript to identify precise topic boundaries, key phrases, and content structure, while using the audio to assess tone, emphasis, and natural speech patterns.

TRANSCRIPT PREVIEW:
${transcript.substring(0, 2000)}${transcript.length > 2000 ? '...' : ''}

AUDIO-FOCUSED APPROACH: Since you're analyzing audio-only content, focus on speech patterns, conversation flow, topic changes, and verbal emphasis. Look for natural pauses, topic transitions, and compelling verbal content.

SEGMENT GUIDELINES:
- Target total duration: ~${job.targetDuration} seconds${formatConfig.totalDuration ? ` (±${formatConfig.totalDuration.tolerance}s)` : ' (flexible)'}
- For ${formatConfig.name}:
  * Number of segments: ${formatConfig.segmentCount.min}-${formatConfig.segmentCount.max} segments (choose what works best for the content)
  * Segment length: ${formatConfig.segmentLength ? `${formatConfig.segmentLength.target}s (${formatConfig.segmentLength.min}-${formatConfig.segmentLength.max}s)` : 'variable - based on natural speech breaks'}
  * ${job.videoFormat === 'long' ? 'Segments will be combined into a single video' : 'Each segment will be a standalone clip'}
  * MINIMUM: Each segment must be at least 5 seconds (anything shorter will be filtered out)

AUDIO ANALYSIS FOCUS:
- Topic changes and natural conversation breaks
- Key insights, explanations, and quotable moments
- Emotional emphasis and compelling statements
- Question-answer sequences
- Story beginnings and conclusions
- Natural pauses and speech rhythm changes

${job.videoFormat === 'long' ? `
LONG FORMAT APPROACH:
- Focus on natural conversation breaks and topic progression
- Each segment should represent a complete thought or discussion point
- Segments can vary in length based on speech content (30 seconds to several minutes)
- Prioritize conversational flow over exact timing constraints
- The combined audio should tell a complete, engaging story
- Aim for approximately ${job.targetDuration} seconds total, but content quality is more important than exact timing
- Minimum 15 seconds per segment to ensure meaningful content
` : `
SHORT FORMAT APPROACH:
- Target segments between ${formatConfig.segmentLength!.min} and ${formatConfig.segmentLength!.max} seconds (flexible)
- Target total duration ${job.targetDuration - formatConfig.totalDuration!.tolerance} to ${job.targetDuration + formatConfig.totalDuration!.tolerance} seconds (flexible)
- Focus on high-impact, quotable moments and key insights
- Minimum 5 seconds per segment to ensure usability
- Content quality is more important than exact timing
`}

REQUIRED JSON FORMAT:
You MUST return an array of clip objects with EXACTLY this structure:
[
  {
    "title": "Opening Statement",
    "description": "Speaker introduces main theme with personal anecdote",
    "start_time": 15,
    "end_time": 65,
    "significance": 8.2,
    "narrative_role": "introduction",
    "transition_note": "Natural pause before topic shift"
  }
]

FIELD REQUIREMENTS:
- title: String - Short, descriptive title
- description: String - 1-2 sentence summary of content
- start_time: Number - Exact timestamp in seconds (must be >= 0)
- end_time: Number - Exact timestamp in seconds (must be > start_time)
- significance: Number - Score from 1-10 based on importance
- narrative_role: String - One of: "introduction", "development", "climax", "resolution", "supporting"
- transition_note: String - How this segment connects to the narrative flow
- NO overlapping timestamps
- Order segments chronologically (by start_time)

Remember: Focus on speech-driven content that works well as audio/podcast clips. The goal is to create ${job.videoFormat === 'long' ? 'a single cohesive audio experience' : 'standalone audio clips'} that capture the most engaging spoken content.

Use the transcript to identify:
- Exact topic boundaries and natural conversation breaks
- Key phrases and quotable moments
- Question-answer sequences and their precise timing
- Story beginnings and conclusions
- Natural speech patterns and emphasis points

${userInstructions}

CRITICAL REMINDER: Return ONLY the JSON array. No other text or formatting.`

    try {
        // Upload audio file to Gemini
        const fileResponse = await fetch(audioUrl)
        if (!fileResponse.ok) {
            throw new Error(`Failed to download audio: ${fileResponse.status}`)
        }
        
        const buffer = await fileResponse.arrayBuffer()
        const blob = new Blob([buffer], { type: audioMimeType })
        
        const uploadedFile = await ai.files.upload({
            file: blob,
            config: { mimeType: audioMimeType }
        })
        
        if (!uploadedFile.name) {
            throw new Error('Audio file upload failed - no file name returned')
        }
        
        // Wait for file processing
        let file = await ai.files.get({ name: uploadedFile.name })
        while (file.state === 'PROCESSING') {
            await new Promise(resolve => setTimeout(resolve, 2000))
            file = await ai.files.get({ name: uploadedFile.name })
        }
        
        if (file.state === 'FAILED') {
            throw new Error('Audio file processing failed')
        }
        
        // Generate content using audio-only analysis
        const content = createUserContent([
            prompt,
            createPartFromUri(uploadedFile.uri || '', audioMimeType)
        ])
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash-exp',
            contents: [content],
            config: {
                maxOutputTokens: 4096,
                temperature: 0.2,
                topP: 0.8,
            }
        })
        
        const responseText = response.candidates?.[0]?.content?.parts?.[0]?.text || ''
        console.log(`[QuickClips Audio] Raw AI response:`, responseText.substring(0, 500))
        
        // Parse JSON response (same logic as video processing)
        let clips = []
        try {
            // First try: direct parse after cleaning
            const cleanedResponse = responseText
                .replace(/```json/g, '')  // Remove markdown code block markers
                .replace(/```/g, '')
                .trim()
            
            try {
                clips = JSON.parse(cleanedResponse)
            } catch (directParseError) {
                console.log(`[QuickClips Audio] Direct parse failed, trying array extraction...`)
                
                // Second try: find array pattern
                const arrayMatch = cleanedResponse.match(/\[\s*\{[\s\S]*?\}\s*\]/g)
                if (arrayMatch) {
                    try {
                        clips = JSON.parse(arrayMatch[0])
                    } catch (arrayParseError) {
                        console.log(`[QuickClips Audio] Array extraction failed, trying object extraction...`)
                        
                        // Third try: extract individual objects
                        const objectPattern = /\{\s*"title"[\s\S]*?"end_time"\s*:\s*\d+[\s\S]*?\}/g
                        const objectMatches = cleanedResponse.match(objectPattern)
                        
                        if (objectMatches) {
                            clips = objectMatches
                                .map(match => {
                                    try {
                                        return JSON.parse(match)
                                    } catch (e) {
                                        console.log(`[QuickClips Audio] Failed to parse object: ${match.substring(0, 50)}...`)
                                        return null
                                    }
                                })
                                .filter(Boolean)
                        }
                    }
                }
            }
            
            // Validate clip structure
            clips = clips.filter((clip: AIGeneratedClip) => {
                const isValid = clip && 
                    typeof clip.title === 'string' &&
                    typeof clip.description === 'string' &&
                    typeof clip.start_time === 'number' && 
                    typeof clip.end_time === 'number' &&
                    clip.end_time > clip.start_time &&
                    (clip.end_time - clip.start_time) >= 5 // Minimum 5 seconds
                
                if (!isValid) {
                    console.log(`[QuickClips Audio] Filtered out invalid clip:`, clip)
                }
                
                return isValid
            })
            
            if (clips.length === 0) {
                throw new Error('No valid clips found after parsing and validation')
            }
            
            // Sort clips by start time
            clips.sort((a: AIGeneratedClip, b: AIGeneratedClip) => a.start_time - b.start_time)
            
            console.log(`[QuickClips Audio] Successfully parsed ${clips.length} clips`)
            
        } catch (error: unknown) {
            console.error('[QuickClips Audio] Failed to parse response:', error)
            console.error('[QuickClips Audio] Raw response:', responseText)
            throw new Error(`Failed to parse audio analysis output: ${error instanceof Error ? error.message : String(error)}`)
        }
        
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
        
        return { clips, transcript }
        
    } catch (error) {
        console.error('[QuickClips Audio] Audio processing failed:', error)
        
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
  * Segment length: ${formatConfig.segmentLength ? `${formatConfig.segmentLength.target}s (${formatConfig.segmentLength.min}-${formatConfig.segmentLength.max}s)` : 'variable - based on natural content breaks'}
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
                            '-g 60',
                            '-vf scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black'
                        ])
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
                            '-g 60',
                            '-vf scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2:black'
                        ])
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