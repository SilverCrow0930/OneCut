import { Router, Request, Response, NextFunction } from 'express'
import { check, validationResult } from 'express-validator'
import { supabase } from '../config/supabaseClient.js'
import { AuthenticatedRequest } from '../middleware/authenticate.js'
import { generateDefaultName } from '../lib/utils.js'
import { DBClip as Clip } from '../types/clips.js'

const router = Router()

type RequestHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>

// GET /api/v1/projects — list all projects for the current user
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

// GET /api/v1/projects/:id — fetch one project
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

// POST /api/v1/projects — create a new project
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
            const projectName = req.body.name || generateDefaultName()
            const projectData = {
                user_id: profile.id,
                name: projectName,
                thumbnail_url: req.body.thumbnail_url || null,
                duration: req.body.duration || 0,
                is_public: req.body.is_public || false,
                // QuickClips fields
                type: req.body.type || 'project',
                processing_status: req.body.processing_status || 'idle',
                processing_message: req.body.processing_message || null,
                quickclips_data: req.body.quickclips_data || null
            }
            
            const { data, error } = await supabase
                .from('projects')
                .insert(projectData)
                .select('*')
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

// PUT /api/v1/projects/:id — update an existing project
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

// DELETE /api/v1/projects/:id — delete a project
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

// GET /api/v1/projects/:projectId/timeline
router.get(
    '/:projectId/timeline',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { projectId } = req.params
            const { user } = req as AuthenticatedRequest

            // 1) Find your app-profile ID
            const { data: profile, error: profErr } = await supabase
                .from('users')
                .select('id')
                .eq('auth_id', user.id)
                .single()
            if (profErr || !profile) {
                console.error('Profile lookup failed:', profErr)
                return res.status(500).json({ error: 'Could not load user profile' })
            }

            // 2) Ownership check against the **profile.id**, not auth UID
            const { data: proj, error: projErr } = await supabase
                .from('projects')
                .select('id')
                .eq('id', projectId)
                .eq('user_id', profile.id)
                .single()
            if (projErr || !proj) {
                return res.status(404).json({ error: 'Project not found' })
            }

            // 3) Fetch tracks
            const { data: tracks, error: tracksErr } = await supabase
                .from('tracks')
                .select('*')
                .eq('project_id', projectId)
                .order('index', { ascending: true })
            if (tracksErr) {
                return res.status(500).json({ error: tracksErr.message })
            }

            // 4) Fetch clips
            const { data: clips, error: clipsErr } = await supabase
                .from('clips')
                .select('*')
                .in('track_id', tracks.map(t => t.id))
                .order('timeline_start_ms', { ascending: true })
            if (clipsErr) {
                return res.status(500).json({ error: clipsErr.message })
            }

            return res.json({ tracks, clips })
        } catch (err) {
            next(err)
        }
    }
)

// PUT /api/v1/projects/:projectId/timeline
router.put(
    '/:projectId/timeline',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { projectId } = req.params
            const { user } = req as AuthenticatedRequest
            const { tracks, clips } = req.body as {
                tracks: Array<{ id: string; project_id?: string; index: number; type: string }>
                clips: Array<Partial<Record<keyof Clip, any>> & { id: string; track_id: string }>
            }

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

            // 1) Ownership check
            const { data: project, error: projectErr } = await supabase
                .from('projects')
                .select('id')
                .eq('id', projectId)
                .eq('user_id', profile.id)
                .single()

            if (projectErr || !project) {
                return res.status(404).json({ error: 'Project not found' })
            }

            // 2) Replace tracks & clips
            //    Note: Supabase JS doesn't support transactions directly,
            //    so we do sequential deletes/inserts. For production, wrap in a Postgres function.

            // Delete existing tracks & clips
            const trackIds = tracks.map(t => t.id)
            await supabase.from('clips').delete().in('track_id', trackIds)
            await supabase.from('tracks').delete().eq('project_id', projectId)

            // Insert new tracks
            if (tracks.length) {
                await supabase
                    .from('tracks')
                    .insert(tracks.map(t => ({ ...t, project_id: projectId })))
            }

            // Insert new clips
            if (clips.length) {
                await supabase
                    .from('clips')
                    .insert(clips)
            }

            res.sendStatus(204)
        } catch (err) {
            next(err)
        }
    }
)

export default router