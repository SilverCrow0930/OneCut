import { Router, Request, Response, NextFunction } from 'express'
import { check, validationResult } from 'express-validator'
import { supabase } from '../config/supabaseClient'
import { AuthenticatedRequest } from '../middleware/authenticate'
import { generateCaptions } from '../integrations/googleGenAI'
import { bucket } from '../integrations/googleStorage'
import { spawn } from 'child_process'
import { v4 as uuid } from 'uuid'
import fs from 'fs'
import path from 'path'
import os from 'os'

const router = Router()

interface TimelineClip {
    id: string
    asset_id: string
    timeline_start_ms: number
    timeline_end_ms: number
    source_start_ms: number
    source_end_ms: number
}

interface TimelineAsset {
    id: string
    object_key: string
    mime_type: string
}

// GET /api/v1/captions/:projectId — get captions for a project
router.get(
    '/:projectId',
    check('projectId').isUUID().withMessage('Invalid project ID'),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const errors = validationResult(req)
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() })
            }

            const { user } = req as AuthenticatedRequest
            const { projectId } = req.params

            // 1) Find user profile
            const { data: profile, error: profileError } = await supabase
                .from('users')
                .select('id')
                .eq('auth_id', user.id)
                .single()

            if (profileError || !profile) {
                return res.status(500).json({ error: 'Could not load user profile' })
            }

            // 2) Verify project ownership
            const { data: project, error: projectError } = await supabase
                .from('projects')
                .select('id')
                .eq('id', projectId)
                .eq('user_id', profile.id)
                .single()

            if (projectError || !project) {
                return res.status(404).json({ error: 'Project not found' })
            }

            // 3) Fetch captions
            const { data: captions, error: captionsError } = await supabase
                .from('captions')
                .select('*')
                .eq('project_id', projectId)
                .order('start_ms', { ascending: true })

            if (captionsError) {
                return res.status(500).json({ error: captionsError.message })
            }

            return res.json(captions || [])
        } catch (err) {
            next(err)
        }
    }
)

// POST /api/v1/captions/:projectId/generate — generate AI captions for a project
router.post(
    '/:projectId/generate',
    check('projectId').isUUID().withMessage('Invalid project ID'),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const errors = validationResult(req)
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() })
            }

            const { user } = req as AuthenticatedRequest
            const { projectId } = req.params

            console.log('🎬 Starting caption generation for project:', projectId)

            // 1) Find user profile
            const { data: profile, error: profileError } = await supabase
                .from('users')
                .select('id')
                .eq('auth_id', user.id)
                .single()

            if (profileError || !profile) {
                return res.status(500).json({ error: 'Could not load user profile' })
            }

            // 2) Verify project ownership
            const { data: project, error: projectError } = await supabase
                .from('projects')
                .select('id')
                .eq('id', projectId)
                .eq('user_id', profile.id)
                .single()

            if (projectError || !project) {
                return res.status(404).json({ error: 'Project not found' })
            }

            // 3) For now, return mock captions to test the routing
            const mockCaptions = [
                {
                    start_ms: 0,
                    end_ms: 3000,
                    text: "Hello and welcome to this video",
                    confidence: 0.95
                },
                {
                    start_ms: 3000,
                    end_ms: 6000,
                    text: "Today we're going to learn about AI",
                    confidence: 0.92
                }
            ]

            // 4) Clear existing captions for this project
            await supabase
                .from('captions')
                .delete()
                .eq('project_id', projectId)

            // 5) Insert mock captions
            if (mockCaptions.length > 0) {
                const { error: insertError } = await supabase
                    .from('captions')
                    .insert(
                        mockCaptions.map(caption => ({
                            project_id: projectId,
                            start_ms: caption.start_ms,
                            end_ms: caption.end_ms,
                            text: caption.text,
                            confidence: caption.confidence
                        }))
                    )

                if (insertError) {
                    console.error('Failed to insert captions:', insertError)
                    return res.status(500).json({ error: 'Failed to save captions' })
                }
            }

            console.log('💾 Saved', mockCaptions.length, 'mock captions to database')

            return res.json({
                success: true,
                captions: mockCaptions.map(caption => ({
                    id: 'mock-id-' + caption.start_ms,
                    project_id: projectId,
                    start_ms: caption.start_ms,
                    end_ms: caption.end_ms,
                    text: caption.text,
                    confidence: caption.confidence,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })),
                message: `Generated ${mockCaptions.length} captions successfully (mock data)`
            })

        } catch (err) {
            console.error('Caption generation error:', err)
            next(err)
        }
    }
)

// PUT /api/v1/captions/:id — update a specific caption
router.put(
    '/:id',
    check('id').isUUID().withMessage('Invalid caption ID'),
    check('text').isString().trim().isLength({ min: 1 }).withMessage('Text is required'),
    check('start_ms').isInt({ min: 0 }).withMessage('start_ms must be a positive integer'),
    check('end_ms').isInt({ min: 1 }).withMessage('end_ms must be a positive integer'),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const errors = validationResult(req)
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() })
            }

            const { user } = req as AuthenticatedRequest
            const { id } = req.params
            const { text, start_ms, end_ms } = req.body

            if (end_ms <= start_ms) {
                return res.status(400).json({ error: 'end_ms must be greater than start_ms' })
            }

            // 1) Find user profile
            const { data: profile, error: profileError } = await supabase
                .from('users')
                .select('id')
                .eq('auth_id', user.id)
                .single()

            if (profileError || !profile) {
                return res.status(500).json({ error: 'Could not load user profile' })
            }

            // 2) Get caption and verify ownership through project
            const { data: caption, error: captionError } = await supabase
                .from('captions')
                .select('*, projects!inner(user_id)')
                .eq('id', id)
                .single()

            if (captionError || !caption) {
                return res.status(404).json({ error: 'Caption not found' })
            }

            // 3) Check if user owns the project
            if (caption.projects.user_id !== profile.id) {
                return res.status(403).json({ error: 'Access denied' })
            }

            // 4) Update caption
            const { data: updatedCaption, error: updateError } = await supabase
                .from('captions')
                .update({ text, start_ms, end_ms })
                .eq('id', id)
                .select('*')
                .single()

            if (updateError) {
                return res.status(500).json({ error: updateError.message })
            }

            return res.json(updatedCaption)
        } catch (err) {
            next(err)
        }
    }
)

// DELETE /api/v1/captions/:id — delete a specific caption
router.delete(
    '/:id',
    check('id').isUUID().withMessage('Invalid caption ID'),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const errors = validationResult(req)
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() })
            }

            const { user } = req as AuthenticatedRequest
            const { id } = req.params

            // 1) Find user profile
            const { data: profile, error: profileError } = await supabase
                .from('users')
                .select('id')
                .eq('auth_id', user.id)
                .single()

            if (profileError || !profile) {
                return res.status(500).json({ error: 'Could not load user profile' })
            }

            // 2) Get caption and verify ownership through project
            const { data: caption, error: captionError } = await supabase
                .from('captions')
                .select('*, projects!inner(user_id)')
                .eq('id', id)
                .single()

            if (captionError || !caption) {
                return res.status(404).json({ error: 'Caption not found' })
            }

            // 3) Check if user owns the project
            if (caption.projects.user_id !== profile.id) {
                return res.status(403).json({ error: 'Access denied' })
            }

            // 4) Delete caption
            const { error: deleteError } = await supabase
                .from('captions')
                .delete()
                .eq('id', id)

            if (deleteError) {
                return res.status(500).json({ error: deleteError.message })
            }

            return res.sendStatus(204)
        } catch (err) {
            next(err)
        }
    }
)

export default router 