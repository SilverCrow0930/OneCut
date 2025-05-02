// src/api/auth.ts
import { Router, Request, Response } from 'express'
import { supabase } from '../config/supabaseClient'
import { AuthenticatedRequest } from '../middleware/authenticate'

const router = Router()

/**
 * GET /api/auth/me
 * Returns the authenticated user's profile from public.users.
 */
router.get(
    '/me',
    (async (req: Request, res: Response) => {
        const authReq = req as unknown as AuthenticatedRequest
        const { user } = authReq

        try {
            const { data: profile, error } = await supabase
                .from('users')
                .select(`
                    id,
                    auth_id,
                    email,
                    full_name,
                    avatar_url,
                    last_login_at,
                    created_at,
                    updated_at
                `)
                .eq('auth_id', user.id)
                .single()

            if (error) {
                console.error('Error loading profile:', error)
                return res.status(500).json({ error: error.message })
            }

            return res.json(profile)
        } catch (err) {
            console.error('Unexpected error in /auth/me:', err)
            return res.status(500).json({ error: 'Internal server error' })
        }
    }) as any
)

export default router