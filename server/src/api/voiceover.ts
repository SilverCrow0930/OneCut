import { Router, Request, Response, NextFunction } from 'express'
import { check, validationResult } from 'express-validator'
import { supabase } from '../config/supabaseClient.js'
import { AuthenticatedRequest } from '../middleware/authenticate.js'
import { getVoices, generateSpeech, getVoiceById, VoiceSettings } from '../integrations/elevenlabs.js'
import { bucket } from '../integrations/googleStorage.js'
import { v4 as uuid } from 'uuid'

const router = Router()

type RequestHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>

// GET /api/v1/voiceover/voices — get all available ElevenLabs voices
router.get(
    '/voices',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { user } = req as AuthenticatedRequest

            console.log('=== VOICEOVER VOICES REQUEST ===')
            console.log('User:', user.id)

            // Fetch voices from ElevenLabs
            console.log('Fetching voices from ElevenLabs...')
            const voices = await getVoices()

            // Filter and format voices for frontend
            const formattedVoices = voices.map(voice => ({
                id: voice.voice_id,
                name: voice.name,
                category: voice.category,
                description: voice.description,
                previewUrl: voice.preview_url,
                labels: voice.labels,
                settings: voice.settings
            }))

            console.log('Voices fetched successfully:', {
                count: formattedVoices.length
            })

            return res.json({
                voices: formattedVoices
            })

        } catch (error) {
            console.error('Voiceover voices error:', error)
            
            // Handle specific error types
            if (error instanceof Error) {
                if (error.message.includes('API error: 401')) {
                    return res.status(401).json({
                        error: 'ElevenLabs API key is invalid. Please check your configuration.'
                    })
                }
                if (error.message.includes('API error: 403')) {
                    return res.status(403).json({
                        error: 'ElevenLabs API access denied. Please check your subscription.'
                    })
                }
                if (error.message.includes('quota') || error.message.includes('limit')) {
                    return res.status(429).json({
                        error: 'ElevenLabs API quota exceeded. Please try again later.'
                    })
                }
            }
            
            next(error)
        }
    }
)

// POST /api/v1/voiceover/generate — generate voiceover audio
router.post(
    '/generate',
    // Validate request body
    check('text').isString().trim().isLength({ min: 1, max: 5000 }).withMessage('Text must be between 1 and 5000 characters'),
    check('voiceId').isString().trim().isLength({ min: 1 }).withMessage('Voice ID is required'),
    check('settings').optional().isObject().withMessage('Settings must be an object'),
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
            const { text, voiceId, settings } = req.body

            console.log('=== VOICEOVER GENERATION REQUEST ===')
            console.log('User:', user.id)
            console.log('Text length:', text.length)
            console.log('Voice ID:', voiceId)
            console.log('Settings:', settings)

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

            // 2) Generate speech using ElevenLabs
            console.log('Starting speech generation with ElevenLabs...')
            const audioBuffer = await generateSpeech(text, voiceId, settings as VoiceSettings)

            // 3) Upload audio to Google Cloud Storage
            console.log('Uploading audio to Google Cloud Storage...')
            const audioFileName = `${user.id}/voiceover_${uuid()}.mp3`
            const gcsFile = bucket.file(audioFileName)

            await gcsFile.save(audioBuffer, {
                metadata: { 
                    contentType: 'audio/mpeg',
                    cacheControl: 'public, max-age=31536000' // 1 year cache
                },
                public: false,
            })

            console.log('Audio uploaded successfully:', audioFileName)

            // 4) Create asset record in database
            const { data: asset, error: assetError } = await supabase
                .from('assets')
                .insert({
                    user_id: profile.id,
                    name: `Voiceover - ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`,
                    mime_type: 'audio/mpeg',
                    duration: null, // We'll estimate based on text length for now
                    object_key: audioFileName,
                })
                .select('*')
                .single()

            if (assetError || !asset) {
                console.error('Asset creation failed:', assetError)
                return res.status(500).json({
                    error: 'Failed to create asset record'
                })
            }

            console.log('Asset created successfully:', asset.id)

            // 5) Generate signed URL for immediate access
            const [signedUrl] = await gcsFile.getSignedUrl({
                action: 'read',
                expires: Date.now() + 60 * 60 * 1000, // 1 hour
            })

            console.log('Voiceover generation completed successfully')

            return res.json({
                assetId: asset.id,
                name: asset.name,
                url: signedUrl,
                duration: asset.duration,
                text: text,
                voiceId: voiceId
            })

        } catch (error) {
            console.error('Voiceover generation error:', error)
            
            // Handle specific error types
            if (error instanceof Error) {
                if (error.message.includes('ElevenLabs TTS error: 400')) {
                    return res.status(400).json({
                        error: 'Invalid text or voice settings. Please check your input.'
                    })
                }
                if (error.message.includes('ElevenLabs TTS error: 401')) {
                    return res.status(401).json({
                        error: 'ElevenLabs API key is invalid. Please check your configuration.'
                    })
                }
                if (error.message.includes('ElevenLabs TTS error: 403')) {
                    return res.status(403).json({
                        error: 'ElevenLabs API access denied. Please check your subscription.'
                    })
                }
                if (error.message.includes('quota') || error.message.includes('limit')) {
                    return res.status(429).json({
                        error: 'ElevenLabs API quota exceeded. Please try again later.'
                    })
                }
                if (error.message.includes('timeout')) {
                    return res.status(408).json({
                        error: 'Speech generation timed out. Please try with shorter text.'
                    })
                }
            }
            
            next(error)
        }
    }
)

// GET /api/v1/voiceover/voices/:id — get specific voice details
router.get(
    '/voices/:id',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { user } = req as AuthenticatedRequest
            const { id } = req.params

            console.log('=== VOICEOVER VOICE DETAILS REQUEST ===')
            console.log('User:', user.id)
            console.log('Voice ID:', id)

            // Fetch voice details from ElevenLabs
            const voice = await getVoiceById(id)

            // Format voice for frontend
            const formattedVoice = {
                id: voice.voice_id,
                name: voice.name,
                category: voice.category,
                description: voice.description,
                previewUrl: voice.preview_url,
                labels: voice.labels,
                settings: voice.settings
            }

            console.log('Voice details fetched successfully')

            return res.json({
                voice: formattedVoice
            })

        } catch (error) {
            console.error('Voiceover voice details error:', error)
            
            // Handle specific error types
            if (error instanceof Error) {
                if (error.message.includes('API error: 404')) {
                    return res.status(404).json({
                        error: 'Voice not found'
                    })
                }
                if (error.message.includes('API error: 401')) {
                    return res.status(401).json({
                        error: 'ElevenLabs API key is invalid. Please check your configuration.'
                    })
                }
            }
            
            next(error)
        }
    }
)

export default router 