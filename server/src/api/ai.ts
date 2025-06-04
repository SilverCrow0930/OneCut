import { Router, Request, Response, NextFunction } from 'express'
import { check, validationResult } from 'express-validator'
import { AuthenticatedRequest } from '../middleware/authenticate.js'
import { fal } from '@fal-ai/client'

const router = Router()

// Configure Fal.ai client
fal.config({
    credentials: process.env.FAL_API_KEY
})

// Fal.ai model mappings with quality options
const FAL_MODELS = {
    image: {
        'normal': 'fal-ai/flux/dev',
        'premium': 'fal-ai/lumina-image/v2', 
        'high_quality': 'fal-ai/flux-pro/v1.1'
    },
    video: {
        'normal': 'fal-ai/ltx-video-13b-distilled',
        'high_quality': 'fal-ai/kling-video/v1.6/standard/text-to-video'
    },
    music: {
        'normal': 'fal-ai/lyria2'
    }
}

// Model display names for frontend
const MODEL_DISPLAY_NAMES = {
    image: {
        'normal': 'Flux Dev',
        'premium': 'Lumina V2',
        'high_quality': 'Flux Pro 1.1'
    },
    video: {
        'normal': 'LTX Video 13B',
        'high_quality': 'Kling Video V1.6'
    },
    music: {
        'normal': 'Lyria 2'
    }
}

// Helper function to get model display name
const getModelDisplayName = (type: string, quality: string): string => {
    const typeModels = MODEL_DISPLAY_NAMES[type as keyof typeof MODEL_DISPLAY_NAMES]
    if (typeModels && quality in typeModels) {
        return typeModels[quality as keyof typeof typeModels]
    }
    return `${type} ${quality}`
}

// POST /api/v1/ai/generate - Generate content using Fal.ai
router.post(
    '/generate',
    [
        check('type').isIn(['image', 'video', 'music']).withMessage('Invalid generation type'),
        check('prompt').isString().isLength({ min: 1, max: 2000 }).withMessage('Prompt is required and must be under 2000 characters'),
        check('quality').optional().isIn(['normal', 'premium', 'high_quality']).withMessage('Invalid quality option')
    ],
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const errors = validationResult(req)
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() })
            }

            const { user } = req as AuthenticatedRequest
            const { type, prompt, quality = 'normal', style, aspect_ratio, duration, motion, genre } = req.body

            console.log(`🎨 Starting ${type} generation with Fal.ai:`, { prompt, type, quality })

            if (!process.env.FAL_API_KEY) {
                console.error('❌ FAL_API_KEY environment variable not set')
                return res.status(500).json({ error: 'AI service not configured' })
            }

            // Get the appropriate model based on type and quality
            const typeModels = FAL_MODELS[type as keyof typeof FAL_MODELS]
            const model = typeModels[quality as keyof typeof typeModels] || typeModels['normal']
            
            if (!model) {
                return res.status(400).json({ error: `Invalid quality option for ${type}` })
            }

            let input: any = { prompt }

            // Configure input based on generation type and model
            switch (type) {
                case 'image':
                    // Add image-specific parameters
                    if (aspect_ratio) {
                        // Convert aspect ratio to width/height based on model
                        const ratios: { [key: string]: { width: number, height: number } } = {
                            '1:1': { width: 1024, height: 1024 },
                            '16:9': { width: 1344, height: 768 },
                            '9:16': { width: 768, height: 1344 },
                            '4:3': { width: 1152, height: 896 }
                        }
                        const ratio = ratios[aspect_ratio] || ratios['16:9']
                        
                        // Different models may have different parameter names
                        if (model.includes('lumina')) {
                            input.width = ratio.width
                            input.height = ratio.height
                        } else {
                            input.image_size = `${ratio.width}x${ratio.height}`
                        }
                    }
                    
                    // Add style for applicable models
                    if (style && !model.includes('lumina')) {
                        input.prompt = `${prompt}, ${style} style`
                    }
                    break

                case 'video':
                    // Add video-specific parameters
                    if (duration) {
                        input.duration = parseInt(duration)
                    }
                    if (motion) {
                        // Map motion levels to generation parameters
                        const motionMap: { [key: string]: string } = {
                            'subtle': 'low motion, stable, slow movement',
                            'moderate': 'medium motion, smooth movement',
                            'dynamic': 'high motion, dynamic movement, fast action'
                        }
                        input.prompt = `${prompt}, ${motionMap[motion] || 'medium motion'}`
                    }
                    
                    // Model-specific parameters
                    if (model.includes('kling')) {
                        // Kling Video specific settings
                        input.aspect_ratio = aspect_ratio || '16:9'
                        input.creativity = 0.7
                    }
                    break

                case 'music':
                    // Add music-specific parameters for Lyria2
                    if (duration) {
                        // Lyria2 supports up to 30 seconds
                        const musicDuration = Math.min(parseInt(duration), 30)
                        input.duration = musicDuration
                    }
                    if (genre) {
                        input.prompt = `${genre} music: ${prompt}`
                    }
                    break
            }

            console.log(`🚀 Calling Fal.ai model: ${model} with input:`, input)

            // Call Fal.ai API
            const result = await fal.subscribe(model, {
                input,
                logs: true,
                onQueueUpdate: (update) => {
                    console.log(`📊 Queue update for ${type}:`, update.status)
                    if (update.status === "IN_PROGRESS") {
                        update.logs?.map((log) => log.message).forEach(console.log)
                    }
                },
            })

            console.log(`✅ Fal.ai ${type} generation completed:`, result.data)

            // Extract the generated content URL
            let contentUrl: string
            let filename: string

            switch (type) {
                case 'image':
                    contentUrl = result.data.images?.[0]?.url || result.data.image?.url
                    filename = `generated_image_${Date.now()}.png`
                    break
                case 'video':
                    contentUrl = result.data.video?.url || result.data.url
                    filename = `generated_video_${Date.now()}.mp4`
                    break
                case 'music':
                    contentUrl = result.data.audio?.url || result.data.url
                    filename = `generated_music_${Date.now()}.wav`
                    break
                default:
                    throw new Error('Unknown generation type')
            }

            if (!contentUrl) {
                console.error('❌ No content URL in Fal.ai response:', result.data)
                throw new Error('Failed to get generated content URL')
            }

            // Return the result
            res.json({
                success: true,
                type,
                quality,
                model: getModelDisplayName(type, quality),
                url: contentUrl,
                filename,
                prompt,
                requestId: result.requestId,
                data: result.data
            })

        } catch (error: any) {
            console.error(`❌ ${req.body.type || 'AI'} generation failed:`, error)
            
            // Handle specific Fal.ai errors
            let errorMessage = 'Failed to generate content'
            if (error.message?.includes('quota')) {
                errorMessage = 'API quota exceeded. Please try again later.'
            } else if (error.message?.includes('timeout')) {
                errorMessage = 'Generation timed out. Please try a simpler prompt.'
            } else if (error.message?.includes('content_policy')) {
                errorMessage = 'Content violates policy. Please try a different prompt.'
            } else if (error.message?.includes('rate limit')) {
                errorMessage = 'Rate limit exceeded. Please wait a moment and try again.'
            } else if (error.message) {
                errorMessage = error.message
            }

            res.status(500).json({
                error: errorMessage,
                type: req.body.type || 'unknown'
            })
        }
    }
)

// GET /api/v1/ai/models - Get available AI models info
router.get('/models', async (req: Request, res: Response) => {
    res.json({
        models: {
            image: {
                options: [
                    { value: 'normal', label: 'Flux Dev', description: 'Standard quality image generation' },
                    { value: 'premium', label: 'Lumina V2', description: 'Premium thumbnail generation' },
                    { value: 'high_quality', label: 'Flux Pro 1.1', description: 'Highest quality images' }
                ],
                maxResolution: '1344x768',
                supportedRatios: ['1:1', '16:9', '9:16', '4:3']
            },
            video: {
                options: [
                    { value: 'normal', label: 'LTX Video 13B', description: 'Fast video generation' },
                    { value: 'high_quality', label: 'Kling Video V1.6', description: 'High-quality video generation' }
                ],
                maxDuration: 10,
                supportedMotion: ['subtle', 'moderate', 'dynamic']
            },
            music: {
                options: [
                    { value: 'normal', label: 'Lyria 2', description: 'Google\'s advanced music generation' }
                ],
                maxDuration: 30,
                format: '48kHz WAV',
                supportedGenres: ['ambient', 'electronic', 'cinematic', 'acoustic', 'upbeat']
            }
        }
    })
})

export default router 