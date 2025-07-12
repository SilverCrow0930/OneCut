import { Router, Request, Response, NextFunction } from 'express'
import { body, validationResult } from 'express-validator'
import { AuthenticatedRequest } from '../middleware/authenticate.js'
import { queueQuickclipsJob, getJobStatus, getUserJobs } from '../services/quickclipsProcessor.js'
import { supabase } from '../config/supabaseClient.js'

const router = Router()

// Credit calculation helper functions
function calculateSmartCutCredits(durationInSeconds: number, contentType: string): number {
    // Convert to hours and round up to nearest minute first
    const durationInMinutes = Math.ceil(durationInSeconds / 60);
    const durationInHours = durationInMinutes / 60;
    
    // Credits per hour based on content type
    const creditsPerHour = contentType === 'talking_video' ? 20 : 40;
    
    // Calculate and round up
    return Math.ceil(durationInHours * creditsPerHour);
}

async function getVideoDuration(fileUri: string): Promise<number> {
    const ffmpeg = await import('fluent-ffmpeg');
    
    return new Promise((resolve, reject) => {
        ffmpeg.default.ffprobe(fileUri, (err, metadata) => {
            if (err) {
                reject(err);
                return;
            }
            
            const duration = metadata.format?.duration;
            if (!duration) {
                reject(new Error('Could not determine video duration'));
                return;
            }
            
            resolve(duration);
        });
    });
}

async function consumeCredits(userId: string, amount: number, featureName: string): Promise<boolean> {
    try {
        // Get current credits
        const { data: credits, error: creditsError } = await supabase
            .from('user_credits')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (creditsError && creditsError.code !== 'PGRST116') {
            throw creditsError;
        }

        const currentCredits = credits?.current_credits || 0;

        // Check if user has enough credits
        if (currentCredits < amount) {
            console.log(`[QuickClips] Insufficient credits: ${currentCredits} < ${amount}`);
            return false;
        }

        // Update credits
        const newCredits = currentCredits - amount;
        
        const { error: updateError } = await supabase
            .from('user_credits')
            .upsert({
                user_id: userId,
                current_credits: newCredits,
                updated_at: new Date().toISOString()
            });

        if (updateError) {
            throw updateError;
        }

        // Log the credit usage
        const { error: logError } = await supabase
            .from('credit_usage_log')
            .insert({
                user_id: userId,
                feature_name: featureName,
                credits_consumed: amount,
                remaining_credits: newCredits,
                created_at: new Date().toISOString()
            });

        if (logError) {
            console.error('Failed to log credit usage:', logError);
            // Don't fail the request if logging fails
        }

        console.log(`[QuickClips] ✅ Consumed ${amount} credits for ${featureName}. Remaining: ${newCredits}`);
        return true;
    } catch (error) {
        console.error('[QuickClips] Failed to consume credits:', error);
        return false;
    }
}

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

        // 2. Calculate and consume credits (skip for editor mode as it's handled on frontend)
        if (!isEditorMode) {
            try {
                console.log('[Quickclips API] Calculating credits for standalone QuickClips...')
                
                // Get video duration
                const videoDuration = await getVideoDuration(fileUri)
                console.log(`[Quickclips API] Video duration: ${videoDuration} seconds`)
                
                // Calculate credits needed
                const creditsNeeded = calculateSmartCutCredits(videoDuration, contentType)
                console.log(`[Quickclips API] Credits needed: ${creditsNeeded} for ${contentType}`)
                
                // Consume credits
                const featureName = contentType === 'talking_video' ? 'smart-cut-audio' : 'smart-cut-visual'
                const success = await consumeCredits(profile.id, creditsNeeded, featureName)
                
                if (!success) {
                    console.error('[Quickclips API] Credit consumption failed')
                    return res.status(400).json({
                        success: false,
                        error: 'Insufficient credits. Please upgrade your plan or try a shorter video.'
                    })
                }
                
                console.log('[Quickclips API] Credits consumed successfully')
            } catch (error) {
                console.error('[Quickclips API] Error during credit calculation/consumption:', error)
                return res.status(500).json({
                    success: false,
                    error: 'Failed to calculate or consume credits'
                })
            }
        } else {
            console.log('[Quickclips API] Skipping credit consumption for editor mode (handled on frontend)')
        }

        // 3. Queue the background job
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

        // If completed, get clips, description, and transcript from project processing_result
        let clips = null
        let description = null
        let transcript = null
        
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
                    transcript = project.processing_result.transcript || null
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
                ...(description && { description }),
                ...(transcript && { transcript })
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