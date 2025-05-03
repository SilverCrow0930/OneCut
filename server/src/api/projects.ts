import { Router, Request, Response, NextFunction } from 'express'
import { check, validationResult } from 'express-validator'
import { supabase } from '../config/supabaseClient'
import { AuthenticatedRequest } from '../middleware/authenticate'
import { generateDefaultName } from '../lib/utils'

const router = Router()

type RequestHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>

// GET /api/projects — list all projects for the current user
router.get('/', (async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { user } = req as AuthenticatedRequest

        // 1) Find your profile (public.users.id) from auth.users.id
        const { data: profile, error: profileError } = await supabase
            .from('users')
            .select('id')
            .eq('auth_id', user.id)
            .single()

        if (profileError || !profile) {
            console.error('Profile lookup failed:', profileError)
            return res.status(500).json({ error: 'Could not load profile' })
        }

        // 2) Now fetch projects by that profile id
        const { data, error } = await supabase
            .from('projects')
            .select('*')
            .eq('user_id', profile.id)
            .order('created_at', { ascending: false })

        if (error) {
            return res.status(500).json({
                error: error.message
            })
        }

        return res.json(data)
    }
    catch (error) {
        next(error)
    }
}) as RequestHandler)

// GET /api/projects/:id — fetch one project
router.get(
    '/:id',
    // 1) Validate that :id is a UUID
    check('id').isUUID().withMessage('Invalid project ID'),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            // 2) Handle validation errors
            const errors = validationResult(req)
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    errors: errors.array()
                })
            }

            const { user } = req as AuthenticatedRequest
            const { id } = req.params

            // 3) Look up the app‐profile (public.users.id) for this auth.user.id
            const { data: profile, error: profileError } = await supabase
                .from('users')
                .select('id')
                .eq('auth_id', user.id)
                .single()

            if (profileError || !profile) {
                console.error('Profile lookup failed for auth_id=', user.id, profileError)
                return res.status(500).json({
                    error: 'Could not load user profile'
                })
            }

            // 4) Fetch the project by its ID and ensure it belongs to that profile
            const { data, error: projectError } = await supabase
                .from('projects')
                .select('*')
                .eq('id', id)
                .eq('user_id', profile.id)
                .single()

            if (projectError) {
                // 404 if not found, otherwise a server error
                const status = projectError.code === 'PGRST116' ? 404 : 500
                return res.status(status).json({
                    error: projectError.message
                })
            }

            // 5) Return the project
            return res.json(data)
        }
        catch (err) {
            next(err)
        }
    }
)

// POST /api/projects — create a new project
router.post(
    '/',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { user } = req as AuthenticatedRequest

            // 1) Find the public.users row for this auth_id
            const { data: profile, error: profileError } = await supabase
                .from('users')
                .select('id')
                .eq('auth_id', user.id)
                .single()

            if (profileError || !profile) {
                console.error('Could not find public.users for auth_id=', user.id, profileError)
                return res.status(500).json({
                    error: 'Profile lookup failed'
                })
            }

            // 2) Insert new project using the public.users.id
            const projectName = generateDefaultName()
            const { data, error } = await supabase
                .from('projects')
                .insert({
                    user_id: profile.id,
                    name: projectName,
                    thumbnail_url: null,
                    duration: 0,
                    is_public: false,
                })
                .select('id')
                .single()

            if (error || !data) {
                console.error('Project insert error:', error)
                return res.status(500).json({
                    error: error?.message ?? 'Insert failed'
                })
            }

            // 3) Redirect browser to the editor URL
            return res.status(201).json({
                id: data.id
            })
        }
        catch (err) {
            next(err)
        }
    }
)

// PUT /api/projects/:id — update an existing project
router.put(
    '/:id',
    check('id').isUUID().withMessage('Invalid project ID'),
    check('name').optional().isString().trim(),
    check('thumbnail_url').optional().isString(),
    check('duration').optional().isInt({ min: 0 }),
    check('is_public').optional().isBoolean(),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const errors = validationResult(req)
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() })
            }

            const { user } = req as AuthenticatedRequest
            const { id } = req.params

            const updates = req.body

            // lookup profile id
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

            // perform update
            const { data, error } = await supabase
                .from('projects')
                .update(updates)
                .eq('id', id)
                .eq('user_id', profile.id)
                .select('*')
                .single()

            if (error) {
                console.error('Project update error:', error)
                return res.status(500).json({
                    error: error.message
                })
            }

            return res.json(data)
        }
        catch (err) {
            next(err)
        }
    }
)

// DELETE /api/projects/:id — delete a project
router.delete(
    '/:id',
    check('id').isUUID().withMessage('Invalid project ID'),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const errors = validationResult(req)
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    errors: errors.array()
                })
            }

            const { user } = req as AuthenticatedRequest
            const { id } = req.params

            // lookup profile id
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

            // delete project
            const { error } = await supabase
                .from('projects')
                .delete()
                .eq('id', id)
                .eq('user_id', profile.id)

            if (error) {
                console.error('Project delete error:', error)
                return res.status(500).json({
                    error: error.message
                })
            }

            return res.sendStatus(204)
        }
        catch (err) {
            next(err)
        }
    }
)

export default router