import { Router, Request, Response, NextFunction } from 'express'
import { body, validationResult } from 'express-validator'
import { AuthenticatedRequest } from '../middleware/authenticate.js'
import { queueQuickclipsJob, getJobStatus, getUserJobs } from '../services/quickclipsProcessor.js'
import { supabase } from '../config/supabaseClient.js'

const router = Router()

// Validation middleware
const validateQuickclipsRequest = [
    body('projectId').isUUID().withMessage('Valid project ID is required'),
    body('fileUri').isString().trim().notEmpty().withMessage('File URI is required'),
    body('mimeType').isString().trim().notEmpty().withMessage('MIME type is required'),
    body('contentType').isString().trim().notEmpty()
        .withMessage('Content type is required'),
    body('targetDuration').isInt({ min: 20, max: 1800 })
        .withMessage('Target duration must be between 20 seconds and 30 minutes'),
    body('userPrompt').optional().isString().trim().isLength({ max: 500 })
        .withMessage('User prompt must be a string with maximum 500 characters')
]

// POST /api/v1/quickclips/start - Start a new Quickclips processing job
router.post('/start', validateQuickclipsRequest, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            })
        }

        const { user } = req as AuthenticatedRequest
        const { projectId, fileUri, mimeType, contentType, targetDuration, isEditorMode, userPrompt } = req.body

        console.log('[Quickclips API] Starting job for project:', projectId)

        // 1. Verify user owns the project
        const { data: profile, error: profileError } = await supabase
            .from('users')
            .select('id')
            .eq('auth_id', user.id)
            .single()

        if (profileError || !profile) {
            console.error('[Quickclips API] Profile lookup failed:', profileError)
            return res.status(500).json({
                success: false,
                error: 'Could not load user profile'
            })
        }

        const { data: project, error: projectError } = await supabase
            .from('projects')
            .select('id, user_id')
            .eq('id', projectId)
            .eq('user_id', profile.id)
            .single()

        if (projectError || !project) {
            console.error('[Quickclips API] Project verification failed:', projectError)
            return res.status(404).json({
                success: false,
                error: 'Project not found or access denied'
            })
        }

        // 2. Queue the background job
        const jobId = await queueQuickclipsJob(
            projectId,
            fileUri,
            mimeType,
            contentType,
            targetDuration,
            profile.id,
            isEditorMode || false,
            userPrompt
        )

        console.log(`[Quickclips API] Job ${jobId} queued successfully for project ${projectId}`)

        res.json({
            success: true,
            jobId,
            message: 'Quickclips processing started'
        })

    } catch (error) {
        console.error('[Quickclips API] Error starting job:', error)
        next(error)
    }
})

// GET /api/v1/quickclips/status/:jobId - Get job status
router.get('/status/:jobId', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { user } = req as AuthenticatedRequest
        const { jobId } = req.params

        const job = getJobStatus(jobId)
        
        if (!job) {
            return res.status(404).json({
                success: false,
                error: 'Job not found'
            })
        }

        // Verify user owns this job
        const { data: profile, error: profileError } = await supabase
            .from('users')
            .select('id')
            .eq('auth_id', user.id)
            .single()

        if (profileError || !profile || job.userId !== profile.id) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            })
        }

        // If completed, get clips and description from project processing_result
        let clips = null
        let description = null
        
        if (job.status === 'completed') {
            try {
                const { data: project } = await supabase
                    .from('projects')
                    .select('processing_result')
                    .eq('id', job.projectId)
                    .single()
                
                if (project?.processing_result) {
                    clips = project.processing_result.clips || null
                    description = project.processing_result.description || null
                }
            } catch (error) {
                console.warn('[Quickclips API] Could not fetch project result:', error)
            }
        }

        res.json({
            success: true,
            ...({
                id: job.id,
                projectId: job.projectId,
                status: job.status,
                progress: job.progress,
                message: job.message,
                error: job.error,
                createdAt: job.createdAt,
                contentType: job.contentType,
                videoFormat: job.videoFormat,
                ...(clips && { clips }),
                ...(description && { description })
            })
        })

    } catch (error) {
        console.error('[Quickclips API] Error getting job status:', error)
        next(error)
    }
})

// GET /api/v1/quickclips/jobs - Get all jobs for the current user
router.get('/jobs', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { user } = req as AuthenticatedRequest

        const { data: profile, error: profileError } = await supabase
            .from('users')
            .select('id')
            .eq('auth_id', user.id)
            .single()

        if (profileError || !profile) {
            return res.status(500).json({
                success: false,
                error: 'Could not load user profile'
            })
        }

        const jobs = getUserJobs(profile.id)

        res.json({
            success: true,
            jobs: jobs.map(job => ({
                id: job.id,
                projectId: job.projectId,
                status: job.status,
                progress: job.progress,
                message: job.message,
                error: job.error,
                createdAt: job.createdAt,
                contentType: job.contentType,
                videoFormat: job.videoFormat
            }))
        })

    } catch (error) {
        console.error('[Quickclips API] Error getting user jobs:', error)
        next(error)
    }
})

export default router 