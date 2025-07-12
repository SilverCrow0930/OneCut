import { Router, Request, Response, NextFunction } from 'express'
import { body, validationResult } from 'express-validator'
import { AuthenticatedRequest } from '../middleware/authenticate.js'
import { queueQuickclipsJob, getJobStatus, getUserJobs } from '../services/quickclipsProcessor.js'
import { supabase } from '../config/supabaseClient.js'
import { Storage } from '@google-cloud/storage';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';

const router = Router()

// Initialize GCS bucket
const storage = new Storage({
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    keyFilename: process.env.GOOGLE_CLOUD_KEY_FILE,
});
const bucket = storage.bucket(process.env.GOOGLE_CLOUD_STORAGE_BUCKET || 'lemona-edit-assets');

// Credit calculation helper functions
async function calculateCreditsNeeded(fileUri: string, contentType: string): Promise<number> {
    try {
        // First verify we can access and process the video
        const duration = await getVideoDuration(fileUri);
        if (!duration) {
            throw new Error('Could not determine video duration');
        }

        // Calculate hours (rounded up to nearest hour)
        const hours = Math.ceil(duration / 3600);
        
        // Calculate credits based on content type
        let creditsPerHour = 0;
        if (contentType === 'talking_video') {
            creditsPerHour = 20; // Audio-only processing
        } else {
            creditsPerHour = 40; // Full video processing
        }
        
        return hours * creditsPerHour;
    } catch (error) {
        console.error('[QuickClips API] Error during credit calculation:', error);
        throw new Error('Failed to calculate credits needed. Please ensure the video file is accessible and valid.');
    }
}

async function getVideoDuration(fileUri: string): Promise<number> {
    const ffmpeg = await import('fluent-ffmpeg');
    const tempDir = os.tmpdir();
    const tempFile = path.join(tempDir, `temp_${Date.now()}_${Math.random().toString(36).substring(7)}.mp4`);
    
    try {
        // Get signed URL
        const objectKey = fileUri.replace('gs://lemona-edit-assets/', '');
        const file = bucket.file(objectKey);
        const [signedUrl] = await file.getSignedUrl({
            action: 'read',
            expires: Date.now() + 1 * 60 * 60 * 1000, // 1 hour
        });

        // Download file
        const response = await fetch(signedUrl);
        if (!response.ok) {
            throw new Error(`Failed to download video: ${response.status}`);
        }
        const buffer = await response.arrayBuffer();
        await fs.writeFile(tempFile, Buffer.from(buffer));

        // Get duration
        return new Promise((resolve, reject) => {
            ffmpeg.default.ffprobe(tempFile, (err, metadata) => {
                // Clean up temp file
                fs.unlink(tempFile).catch(console.error);
                
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
    } catch (error) {
        // Clean up temp file in case of error
        fs.unlink(tempFile).catch(console.error);
        throw error;
    }
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

// Start QuickClips processing
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

        // Step 1: Verify we can access and process the video
        console.log('[Quickclips API] Verifying video access and calculating credits...');
        const creditsNeeded = await calculateCreditsNeeded(fileUri, contentType);
        
        // Step 2: Get user ID from auth ID
        const { data: userRecord, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('auth_id', user.id)
            .single();

        if (userError || !userRecord) {
            throw new Error('User not found');
        }

        // Step 3: Consume credits
        console.log('[Quickclips API] Consuming credits:', creditsNeeded);
        const success = await consumeCredits(userRecord.id, creditsNeeded, 'smart-cut-audio');
        
        if (!success) {
            console.error('[Quickclips API] Credit consumption failed')
            return res.status(400).json({
                success: false,
                error: 'Insufficient credits. Please upgrade your plan or try a shorter video.'
            })
        }

        // Step 4: Queue the job
        const jobId = await queueQuickclipsJob(
            projectId,
            fileUri,
            mimeType,
            contentType,
            targetDuration,
            userRecord.id,
            isEditorMode || false,
            userPrompt
        )

        console.log(`[Quickclips API] Job ${jobId} queued successfully for project ${projectId}`)

        res.json({ 
            success: true,
            jobId,
            message: 'QuickClips job started successfully'
        });

    } catch (error) {
        console.error('[Quickclips API] Error during credit calculation/consumption:', error);
        next(error)
    }
});

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