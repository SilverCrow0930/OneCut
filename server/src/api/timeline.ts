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

            console.log(`[Timeline Save] Starting save for project ${projectId}`)
            console.log(`[Timeline Save] Tracks to save: ${tracks.length}`)
            console.log(`[Timeline Save] Clips to save: ${clips.length}`)

            const { data: profile, error: profileError } = await supabase
                .from('users')
                .select('id')
                .eq('auth_id', user.id)
                .single()

            if (profileError || !profile) {
                console.error('[Timeline Save] Profile lookup failed:', profileError)
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
                console.error('[Timeline Save] Project ownership check failed:', projectError)
                return res.status(404).json({ error: 'Project not found' })
            }

            // 2) FIXED: Proper deletion order to avoid constraint violations
            console.log('[Timeline Save] Step 1: Deleting existing clips for project')
            
            // First, get all existing track IDs for this project
            const { data: existingTracks, error: existingTracksError } = await supabase
                .from('tracks')
                .select('id')
                .eq('project_id', projectId)

            if (existingTracksError) {
                console.error('[Timeline Save] Failed to fetch existing tracks:', existingTracksError)
                return res.status(500).json({ error: 'Failed to fetch existing tracks' })
            }

            const existingTrackIds = existingTracks?.map(t => t.id) || []
            console.log(`[Timeline Save] Found ${existingTrackIds.length} existing tracks to clean up`)

            // Delete all existing clips for this project's tracks
            if (existingTrackIds.length > 0) {
                const { error: clipDeleteError } = await supabase
                    .from('clips')
                    .delete()
                    .in('track_id', existingTrackIds)

                if (clipDeleteError) {
                    console.error('[Timeline Save] Failed to delete existing clips:', clipDeleteError)
                    return res.status(500).json({ error: 'Failed to delete existing clips' })
                }
                console.log('[Timeline Save] Successfully deleted existing clips')
            }

            // Delete all existing tracks for this project
            console.log('[Timeline Save] Step 2: Deleting existing tracks for project')
            const { error: trackDeleteError } = await supabase
                .from('tracks')
                .delete()
                .eq('project_id', projectId)

            if (trackDeleteError) {
                console.error('[Timeline Save] Failed to delete existing tracks:', trackDeleteError)
                return res.status(500).json({ error: 'Failed to delete existing tracks' })
            }
            console.log('[Timeline Save] Successfully deleted existing tracks')

            // 3) Insert new tracks with validation
            console.log('[Timeline Save] Step 3: Inserting new tracks')
            const trackRows = tracks.map((t, index) => {
                // Validate track data
                if (!t.id) {
                    throw new Error(`Track ${index} missing ID`)
                }
                if (typeof t.index !== 'number') {
                    throw new Error(`Track ${index} (${t.id}) has invalid index: ${t.index}`)
                }
                if (!['video', 'audio', 'text', 'caption'].includes(t.type)) {
                    throw new Error(`Track ${index} (${t.id}) has invalid type: ${t.type}`)
                }

                return {
                    id: t.id,
                    project_id: projectId,
                    index: t.index,
                    type: t.type,
                    created_at: t.created_at || new Date().toISOString(),
                }
            })

            // Check for duplicate track IDs in the new data
            const trackIdSet = new Set<string>()
            const duplicateTrackIds: string[] = []
            trackRows.forEach(track => {
                if (trackIdSet.has(track.id)) {
                    duplicateTrackIds.push(track.id)
                } else {
                    trackIdSet.add(track.id)
                }
            })

            if (duplicateTrackIds.length > 0) {
                console.error('[Timeline Save] Duplicate track IDs detected:', duplicateTrackIds)
                return res.status(400).json({ 
                    error: `Duplicate track IDs detected: ${duplicateTrackIds.join(', ')}` 
                })
            }

            if (trackRows.length > 0) {
                console.log(`[Timeline Save] Inserting ${trackRows.length} tracks:`, trackRows.map(t => ({ id: t.id, index: t.index, type: t.type })))
                
                const { error: trackError } = await supabase
                    .from('tracks')
                    .insert(trackRows)

                if (trackError) {
                    console.error('[Timeline Save] Track insert failed:', trackError)
                    console.error('[Timeline Save] Failed track data:', trackRows)
                    return res.status(500).json({
                        error: `Track insert failed: ${trackError.message}`
                    })
                }
                console.log('[Timeline Save] Successfully inserted tracks')
            }

            // 4) Insert new clips with validation
            console.log('[Timeline Save] Step 4: Inserting new clips')
            const clipRows = clips.map((c, index) => {
                // Validate clip data
                if (!c.id) {
                    throw new Error(`Clip ${index} missing ID`)
                }
                if (!c.track_id) {
                    throw new Error(`Clip ${index} (${c.id}) missing track_id`)
                }
                if (!trackIdSet.has(c.track_id)) {
                    throw new Error(`Clip ${index} (${c.id}) references non-existent track: ${c.track_id}`)
                }

                return {
                    id: c.id,
                    track_id: c.track_id,
                    asset_id: c.asset_id,
                    type: c.type,
                    source_start_ms: c.source_start_ms,
                    source_end_ms: c.source_end_ms,
                    timeline_start_ms: c.timeline_start_ms,
                    timeline_end_ms: c.timeline_end_ms,
                    asset_duration_ms: c.asset_duration_ms,
                    volume: c.volume,
                    speed: c.speed,
                    properties: c.properties,
                    created_at: c.created_at || new Date().toISOString(),
                }
            })

            if (clipRows.length > 0) {
                console.log(`[Timeline Save] Inserting ${clipRows.length} clips`)
                
                const { error: clipError } = await supabase
                    .from('clips')
                    .insert(clipRows)

                if (clipError) {
                    console.error('[Timeline Save] Clip insert failed:', clipError)
                    console.error('[Timeline Save] Failed clip data:', clipRows)
                    return res.status(500).json({
                        error: `Clip insert failed: ${clipError.message}`
                    })
                }
                console.log('[Timeline Save] Successfully inserted clips')
            }

            console.log(`[Timeline Save] Timeline save completed successfully for project ${projectId}`)
            res.sendStatus(204)
        }
        catch (err) {
            console.error('[Timeline Save] Unexpected error:', err)
            next(err)
        }
    }
)

export default router