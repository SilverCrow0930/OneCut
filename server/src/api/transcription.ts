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
    check('clipId').isUUID().withMessage('Invalid clip ID'),
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
            const { clipId } = req.body

            console.log('=== TRANSCRIPTION REQUEST ===')
            console.log('User:', user.id)
            console.log('Clip ID:', clipId)

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

            // 2) Get the clip and verify ownership through project
            const { data: clip, error: clipError } = await supabase
                .from('clips')
                .select(`
                    *,
                    tracks!inner(
                        project_id,
                        projects!inner(
                            user_id
                        )
                    )
                `)
                .eq('id', clipId)
                .single()

            if (clipError || !clip) {
                console.error('Clip lookup failed:', clipError)
                return res.status(404).json({
                    error: 'Clip not found'
                })
            }

            // Verify user owns this clip through the project
            if (clip.tracks.projects.user_id !== profile.id) {
                return res.status(403).json({
                    error: 'Access denied'
                })
            }

            // 3) Get the asset associated with this clip
            if (!clip.asset_id) {
                return res.status(400).json({
                    error: 'Clip has no associated asset'
                })
            }

            const { data: asset, error: assetError } = await supabase
                .from('assets')
                .select('*')
                .eq('id', clip.asset_id)
                .eq('user_id', profile.id)
                .single()

            if (assetError || !asset) {
                console.error('Asset lookup failed:', assetError)
                return res.status(404).json({
                    error: 'Asset not found'
                })
            }

            // 4) Check if asset has audio (video or audio file)
            const isAudioCapable = asset.mime_type.startsWith('video/') || asset.mime_type.startsWith('audio/')
            if (!isAudioCapable) {
                return res.status(400).json({
                    error: 'Asset does not contain audio for transcription'
                })
            }

            // 5) Get signed URL for the asset
            const { bucket } = await import('../integrations/googleStorage.js')
            const [signedUrl] = await bucket
                .file(asset.object_key)
                .getSignedUrl({
                    action: 'read',
                    expires: Date.now() + 60 * 60 * 1000, // 1 hour
                })

            console.log('Generated signed URL for transcription')

            // 6) Generate transcription using Gemini
            console.log('Starting transcription with Gemini...')
            const result = await generateTranscription(signedUrl, asset.mime_type)

            console.log('Transcription completed successfully')

            return res.json({
                clipId: clipId,
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