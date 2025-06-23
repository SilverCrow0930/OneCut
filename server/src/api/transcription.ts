import { Router, Request, Response, NextFunction } from 'express'
import { check, validationResult } from 'express-validator'
import { supabase } from '../config/supabaseClient.js'
import { AuthenticatedRequest } from '../middleware/authenticate.js'
import { generateTranscription } from '../integrations/googleGenAI.js'
import ffmpeg from 'fluent-ffmpeg'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

const router = Router()

type RequestHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>

// POST /api/v1/transcription/generate — generate transcription for a video clip
router.post(
    '/generate',
    // Validate request body
    check('trackId').isUUID().withMessage('Invalid track ID'),
    check('aspectRatio').optional().isIn(['vertical', 'horizontal']).withMessage('Invalid aspect ratio'),
    async (req: Request, res: Response, next: NextFunction) => {
        // Enhanced error handling wrapper
        const handleError = (error: any, step: string) => {
            console.error(`❌ Transcription failed at ${step}:`, error)
            return res.status(500).json({
                error: `Transcription failed at ${step}`,
                message: error.message || 'Unknown error',
                step: step,
                timestamp: new Date().toISOString()
            })
        }

        try {
            console.log('=== TRANSCRIPTION REQUEST STARTED ===')
            
            // Handle validation errors
            const errors = validationResult(req)
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    errors: errors.array()
                })
            }

            const { user } = req as AuthenticatedRequest
            const { trackId, aspectRatio } = req.body

            console.log('User:', user.id)
            console.log('Track ID:', trackId)
            console.log('Aspect Ratio:', aspectRatio)

            // Test GoogleGenAI import availability first
            console.log('🔍 Testing GoogleGenAI import...')
            try {
                const googleGenAI = await import('../integrations/googleGenAI.js')
                if (!googleGenAI.generateTranscription) {
                    throw new Error('generateTranscription function not found in GoogleGenAI module')
                }
                console.log('✅ GoogleGenAI import successful')
            } catch (importError: any) {
                console.error('❌ GoogleGenAI import failed:', importError)
                return res.status(500).json({
                    error: 'Server configuration error: AI transcription service unavailable',
                    details: importError.message,
                    suggestion: 'Please check server logs and restart the server'
                })
            }

            // 1) Find the user's profile
            console.log('🔍 Looking up user profile...')
            const { data: profile, error: profileError } = await supabase
                .from('users')
                .select('id')
                .eq('auth_id', user.id)
                .single()

            if (profileError || !profile) {
                console.error('Profile lookup failed:', profileError)
                return res.status(500).json({
                    error: 'Could not load user profile'
                })
            }

            // 2) Get the track first
            const { data: track, error: trackError } = await supabase
                .from('tracks')
                .select('*')
                .eq('id', trackId)
                .single()

            if (trackError || !track) {
                console.error('Track lookup failed:', trackError)
                return res.status(404).json({
                    error: 'Track not found'
                })
            }

            // 3) Get the project and verify ownership
            const { data: project, error: projectError } = await supabase
                .from('projects')
                .select('user_id')
                .eq('id', track.project_id)
                .single()

            if (projectError || !project) {
                console.error('Project lookup failed:', projectError)
                return res.status(404).json({
                    error: 'Project not found'
                })
            }

            // Verify user owns this project
            if (project.user_id !== profile.id) {
                return res.status(403).json({
                    error: 'Access denied'
                })
            }

            // 4) Get all video/audio clips in this track
            const { data: clips, error: clipsError } = await supabase
                .from('clips')
                .select('*')
                .eq('track_id', trackId)
                .in('type', ['video', 'audio'])
                .not('asset_id', 'is', null)

            if (clipsError || !clips || clips.length === 0) {
                console.error('Clips lookup failed:', clipsError)
                return res.status(400).json({
                    error: 'No transcribable clips found in track'
                })
            }

            // 5) Find the longest clip to use for transcription
            const longestClip = clips.reduce((longest: any, current: any) => 
                (current.timeline_end_ms - current.timeline_start_ms) > (longest.timeline_end_ms - longest.timeline_start_ms) 
                    ? current : longest
            )

            // 6) Get the asset associated with the longest clip
            const { data: asset, error: assetError } = await supabase
                .from('assets')
                .select('*')
                .eq('id', longestClip.asset_id)
                .eq('user_id', profile.id)
                .single()

            if (assetError || !asset) {
                console.error('Asset lookup failed:', assetError)
                return res.status(404).json({
                    error: 'Asset not found'
                })
            }

            // 7) Check if asset has audio (video or audio file)
            const isAudioCapable = asset.mime_type.startsWith('video/') || asset.mime_type.startsWith('audio/')
            if (!isAudioCapable) {
                return res.status(400).json({
                    error: 'Asset does not contain audio for transcription'
                })
            }

            // 8) Get signed URL for the asset
            const { bucket } = await import('../integrations/googleStorage.js')
            const [signedUrl] = await bucket
                .file(asset.object_key)
                .getSignedUrl({
                    action: 'read',
                    expires: Date.now() + 60 * 60 * 1000, // 1 hour
                })

            console.log('Generated signed URL for transcription')

            // 9) Extract audio from video if needed (COST OPTIMIZATION)
            let transcriptionUrl = signedUrl
            let transcriptionMimeType = asset.mime_type
            let tempFilePath: string | null = null

            if (asset.mime_type.startsWith('video/')) {
                console.log('🎵 Video file detected - extracting audio for cost optimization')
                
                try {
                    // Create temporary file paths
                    const tempDir = os.tmpdir()
                    const inputFileName = `input_${Date.now()}_${Math.random().toString(36).substring(7)}.${asset.mime_type.split('/')[1]}`
                    const outputFileName = `audio_${Date.now()}_${Math.random().toString(36).substring(7)}.mp3`
                    const inputPath = path.join(tempDir, inputFileName)
                    const outputPath = path.join(tempDir, outputFileName)
                    tempFilePath = outputPath

                    // Download video file to temp storage
                    console.log('Downloading video file for audio extraction...')
                    const videoResponse = await fetch(signedUrl)
                    if (!videoResponse.ok) {
                        throw new Error(`Failed to download video: ${videoResponse.status}`)
                    }
                    
                    const videoBuffer = await videoResponse.arrayBuffer()
                    await fs.writeFile(inputPath, Buffer.from(videoBuffer))
                    
                    console.log('Extracting audio using FFmpeg...')
                    
                    // Extract audio using FFmpeg
                    await new Promise<void>((resolve, reject) => {
                        ffmpeg(inputPath)
                            .toFormat('mp3')
                            .audioCodec('libmp3lame')
                            .audioChannels(1) // Mono for smaller file size
                            .audioFrequency(22050) // Lower frequency for transcription (sufficient quality)
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
                    const tempAudioKey = `temp/transcription_audio_${Date.now()}_${Math.random().toString(36).substring(7)}.mp3`
                    
                    console.log('Uploading extracted audio to GCS...')
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

                    transcriptionUrl = audioSignedUrl
                    transcriptionMimeType = 'audio/mpeg'

                    // Clean up local temp files
                    await fs.unlink(inputPath).catch(console.error)
                    await fs.unlink(outputPath).catch(console.error)

                    // Schedule cleanup of GCS temp file after 2 hours
                    setTimeout(async () => {
                        try {
                            await file.delete()
                            console.log('🗑️ Cleaned up temporary audio file from GCS')
                        } catch (error) {
                            console.error('Failed to clean up temp audio file:', error)
                        }
                    }, 2 * 60 * 60 * 1000) // 2 hours

                    console.log('🎵 Audio extraction completed - cost optimized for transcription!')
                    
                } catch (audioError) {
                    console.error('Audio extraction failed, falling back to full video:', audioError)
                    // Fall back to original video file if audio extraction fails
                    transcriptionUrl = signedUrl
                    transcriptionMimeType = asset.mime_type
                    
                    // Clean up any temp files
                    if (tempFilePath) {
                        await fs.unlink(tempFilePath).catch(console.error)
                    }
                }
            } else {
                console.log('🎵 Audio file detected - no extraction needed')
            }

            // 10) Determine video format based on user-selected aspect ratio
            // If no aspect ratio provided, default to horizontal (long-form)
            const selectedAspectRatio = aspectRatio || 'horizontal'
            const videoFormat = selectedAspectRatio === 'vertical' ? 'short_vertical' : 'long_horizontal'
            
            console.log('Video format detection:', {
                providedAspectRatio: aspectRatio,
                selectedAspectRatio,
                detectedFormat: videoFormat,
                reasoning: 'Based on user aspect ratio selection (vertical = short-form, horizontal = long-form)'
            })

            // 11) Generate transcription using Gemini with audio-only file
            console.log('Starting transcription with Gemini using audio-optimized file...')
            const result = await generateTranscription(transcriptionUrl, transcriptionMimeType, videoFormat)

            console.log('Transcription completed successfully')

            return res.json({
                trackId: trackId,
                clipId: longestClip.id,
                transcription: result.transcription,
                assetName: asset.name,
                duration: asset.duration,
                optimized: asset.mime_type.startsWith('video/') ? 'audio_extracted' : 'audio_native'
            })

        } catch (error) {
            console.error('Transcription error:', error)
            
            // Handle specific error types
            if (error instanceof Error) {
                if (error.message.includes('503 Service Unavailable')) {
                    return res.status(503).json({
                        error: 'AI service temporarily unavailable. Please try again in a few minutes.'
                    })
                }
                if (error.message.includes('quota') || error.message.includes('limit')) {
                    return res.status(429).json({
                        error: 'API rate limit exceeded. Please try again later.'
                    })
                }
                if (error.message.includes('timeout')) {
                    return res.status(408).json({
                        error: 'Transcription timed out. Please try with a shorter video.'
                    })
                }
            }
            
            next(error)
        }
    }
)

// GET /api/v1/transcription/health — health check for transcription service
router.get('/health', async (req: Request, res: Response) => {
    try {
        console.log('🔍 Testing transcription service health...')
        
        // Test if we can import GoogleGenAI
        const googleGenAI = await import('../integrations/googleGenAI.js')
        
        if (!googleGenAI.generateTranscription) {
            throw new Error('generateTranscription function not found')
        }

        console.log('✅ Transcription service is healthy')
        
        return res.json({
            status: 'healthy',
            service: 'transcription',
            googleGenAI: 'available',
            timestamp: new Date().toISOString()
        })
        
    } catch (error: any) {
        console.error('❌ Transcription service health check failed:', error)
        
        return res.status(500).json({
            status: 'unhealthy',
            service: 'transcription',
            error: error.message,
            timestamp: new Date().toISOString()
        })
    }
})

export default router 