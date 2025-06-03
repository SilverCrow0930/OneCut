import { Router, Request, Response, NextFunction } from 'express'
import { check, validationResult } from 'express-validator'
import { supabase } from '../config/supabaseClient.js'
import { AuthenticatedRequest } from '../middleware/authenticate.js'
import { generateContent, generateTextStyle } from '../integrations/googleGenAI.js'

const router = Router()

type RequestHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>

// POST /api/v1/ai/generate-text-style — generate CSS styles from natural language description
router.post(
    '/generate-text-style',
    // Validate request body
    check('prompt').isString().trim().isLength({ min: 1, max: 500 }).withMessage('Prompt must be between 1 and 500 characters'),
    check('sampleText').optional().isString().trim().isLength({ max: 100 }).withMessage('Sample text must be less than 100 characters'),
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
            const { prompt, sampleText } = req.body

            console.log('=== TEXT STYLE GENERATION REQUEST ===')
            console.log('User:', user.id)
            console.log('Prompt:', prompt)
            console.log('Sample text:', sampleText)

            // Generate text style using Gemini
            console.log('Starting text style generation with Gemini...')
            const result = await generateTextStyle(prompt, sampleText || 'Sample Text')

            console.log('Text style generation completed successfully')

            return res.json({
                style: result.style,
                prompt: prompt
            })

        } catch (error) {
            console.error('Text style generation error:', error)
            
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
                        error: 'Style generation timed out. Please try a simpler description.'
                    })
                }
                if (error.message.includes('invalid style format') || error.message.includes('invalid style object')) {
                    return res.status(422).json({
                        error: 'AI could not generate a valid style. Please try rephrasing your description.'
                    })
                }
            }
            
            next(error)
        }
    }
)

export default router 