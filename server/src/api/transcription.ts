import { Router, Request, Response, NextFunction } from 'express'
import { check, validationResult } from 'express-validator'
import { supabase } from '../config/supabaseClient.js'
import { AuthenticatedRequest } from '../middleware/authenticate.js'
import { generateTranscription } from '../integrations/googleGenAI.js'

const router = Router()

type RequestHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>

// POST /api/v1/transcription/generate — generate transcription for a video clip
router.post(
    '/generate',
    // Validate request body
    check('trackId').isUUID().withMessage('Invalid track ID'),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            // Handle validation errors
            const errors = validationResult(req)
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    errors: errors.array()
                })
            }

            const { user } = req as AuthenticatedRequest
            const { trackId } = req.body

            console.log('=== TRANSCRIPTION REQUEST ===')
            console.log('User:', user.id)
            console.log('Track ID:', trackId)

            // 1) Find the user's profile
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

            // 9) Determine video format based on clip duration (since aspect_ratio is not stored in DB)
            const clipDuration = longestClip.timeline_end_ms - longestClip.timeline_start_ms
            
            // Determine if this is short-form content based on duration only
            // Short-form: duration < 2 minutes (common for TikTok, Instagram Reels, YouTube Shorts)
            const isShortDuration = clipDuration < 120000 // 2 minutes in ms
            const videoFormat = isShortDuration ? 'short_vertical' : 'long_horizontal'
            
            console.log('Video format detection:', {
                durationMs: clipDuration,
                durationSeconds: Math.round(clipDuration / 1000),
                isShortDuration,
                detectedFormat: videoFormat
            })

            // 10) Generate transcription using Gemini
            console.log('Starting transcription with Gemini...')
            const result = await generateTranscription(signedUrl, asset.mime_type, videoFormat)

            console.log('Transcription completed successfully')

            return res.json({
                trackId: trackId,
                clipId: longestClip.id,
                transcription: result.transcription,
                assetName: asset.name,
                duration: asset.duration
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

export default router 