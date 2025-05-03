import { Router, Request, Response, NextFunction } from 'express'
import { body, validationResult } from 'express-validator'
import { supabase } from '../config/supabaseClient'
import { AuthenticatedRequest } from '../middleware/authenticate'

const router = Router()

// GET /api/v1/assets — list the current user's assets
router.get(
    '/',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { user } = req as AuthenticatedRequest

            const { data, error } = await supabase
                .from('assets')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })

            if (error) {
                console.error('Error fetching assets:', error)
                return res.status(500).json({ error: error.message })
            }
            res.json(data)
        }
        catch (err) {
            next(err)
        }
    }
)

// POST /api/v1/assets — register a new asset record
// Expects JSON body: { name, url, mime_type, duration? }
router.post(
    '/',
    // Validation
    body('name').isString().trim().notEmpty(),
    body('url').isURL(),
    body('mime_type').isString().notEmpty(),
    body('duration').optional().isNumeric(),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const errors = validationResult(req)
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() })
            }

            const { user } = req as AuthenticatedRequest
            const { name, url, mime_type, duration = null } = req.body

            const { data, error } = await supabase
                .from('assets')
                .insert({
                    user_id: user.id,
                    name,
                    url,
                    mime_type,
                    duration,
                })
                .select('*')
                .single()

            if (error) {
                console.error('Error inserting asset:', error)
                return res.status(500).json({ error: error.message })
            }
            res.status(201).json(data)
        }
        catch (err) {
            next(err)
        }
    }
)

export default router