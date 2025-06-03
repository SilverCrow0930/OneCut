import { Router, Request, Response, NextFunction } from 'express'
import { supabase } from '../config/supabaseClient.js'
import { AuthenticatedRequest } from '../middleware/authenticate.js'
import { DBClip as Clip } from '../types/clips.js'
import { DBTrack as Track } from '../types/tracks.js'

const router = Router()

// GET /api/v1/timeline/:projectId
router.get(
    '/:projectId',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { projectId } = req.params
            const { user } = req as AuthenticatedRequest

            // 1) Find your app-profile ID
            const { data: profile, error: profileError } = await supabase
                .from('users')
                .select('id')
                .eq('auth_id', user.id)
                .single()

            if (profileError || !profile) {
                console.error('Profile lookup failed:', profileError)
                return res.status(500).json({ error: 'Could not load user profile' })
            }

            // 2) Ownership check against the **profile.id**, not auth UID
            const { data: project, error: projectError } = await supabase
                .from('projects')
                .select('id')
                .eq('id', projectId)
                .eq('user_id', profile.id)
                .single()

            if (projectError || !project) {
                return res.status(404).json({ error: 'Project not found' })
            }

            // 3) Fetch tracks
            const { data: tracks, error: tracksError } = await supabase
                .from('tracks')
                .select('*')
                .eq('project_id', projectId)
                .order('index', { ascending: true })

            if (tracksError) {
                return res.status(500).json({ error: tracksError.message })
            }

            // 4) Fetch clips
            const { data: clips, error: clipsError } = await supabase
                .from('clips')
                .select('*')
                .in('track_id', tracks.map(t => t.id))
                .order('timeline_start_ms', { ascending: true })

            if (clipsError) {
                return res.status(500).json({ error: clipsError.message })
            }

            return res.json({ tracks, clips })
        } catch (err) {
            next(err)
        }
    }
)

// PUT /api/v1/timeline/:projectId
router.put(
    '/:projectId',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { projectId } = req.params
            const { user } = req as AuthenticatedRequest
            const { tracks, clips } = req.body as {
                tracks: Array<Track>
                clips: Array<Clip>
            }

            console.log('tracks', tracks)
            console.log('clips', clips)

            const { data: profile, error: profileError } = await supabase
                .from('users')
                .select('id')
                .eq('auth_id', user.id)
                .single()

            if (profileError || !profile) {
                return res.status(500).json({ error: 'Could not load user profile' })
            }

            // 1) Ownership check
            const { data: project, error: projectError } = await supabase
                .from('projects')
                .select('id')
                .eq('id', projectId)
                .eq('user_id', profile.id)
                .single()

            if (projectError || !project) {
                return res.status(404).json({ error: 'Project not found' })
            }

            // 2) Replace tracks & clips
            //    Note: Supabase JS doesn't support transactions directly,
            //    so we do sequential deletes/inserts. For production, wrap in a Postgres function.

            // Delete existing tracks & clips
            const trackIds = tracks.map(t => t.id)
            await supabase.from('clips').delete().in('track_id', trackIds)
            await supabase.from('tracks').delete().eq('project_id', projectId)

            const trackRows = tracks.map(t => ({
                id: t.id,
                project_id: projectId,
                index: t.index,
                type: t.type,
                created_at: t.created_at,   // or omit to use DEFAULT now()
            }))

            if (trackRows.length) {
                const { error: trackError } = await supabase
                    .from('tracks')
                    .insert(trackRows)

                if (trackError) {
                    console.error('Track insert failed:', trackError)
                    return res.status(500).json({
                        error: trackError.message
                    })
                }
            }

            // 5) Map & insert **clips**
            const clipRows = clips.map(c => ({
                id: c.id,
                track_id: c.track_id,
                asset_id: c.asset_id,
                type: c.type,
                source_start_ms: c.source_start_ms,
                source_end_ms: c.source_end_ms,
                timeline_start_ms: c.timeline_start_ms,
                timeline_end_ms: c.timeline_end_ms,
                volume: c.volume,
                speed: c.speed,
                properties: c.properties,
                created_at: c.created_at,
            }))

            if (clipRows.length) {
                const { error: clipError } = await supabase
                    .from('clips')
                    .insert(clipRows)

                if (clipError) {
                    console.error('Clip insert failed:', clipError)
                    return res.status(500).json({
                        error: clipError.message
                    })
                }
            }

            res.sendStatus(204)
        }
        catch (err) {
            next(err)
        }
    }
)

export default router