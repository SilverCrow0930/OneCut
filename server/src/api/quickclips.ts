import { Router, Request, Response, NextFunction } from 'express'
import { check, validationResult } from 'express-validator'
import { supabase } from '../config/supabaseClient.js'
import { AuthenticatedRequest } from '../middleware/authenticate.js'

const router = Router()

type RequestHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>

interface QuickClipsRequestBody {
    projectId: string
    fileUri: string
    mimeType: string
    contentType: string
    targetDuration: number
    videoFormat: 'short_vertical' | 'long_horizontal'
}

interface QuickClip {
    id: string
    title: string
    duration: number
    start_time: number
    end_time: number
    viral_score: number
    description: string
    thumbnail: string
    downloadUrl: string
    previewUrl: string
}

// POST /api/v1/quickclips/process — start background processing
router.post(
    '/process',
    [
        check('projectId').isUUID().withMessage('Invalid project ID'),
        check('fileUri').isString().withMessage('File URI is required'),
        check('contentType').isString().withMessage('Content type is required'),
        check('targetDuration').isInt({ min: 20, max: 1800 }).withMessage('Invalid target duration'),
        check('videoFormat').isIn(['short_vertical', 'long_horizontal']).withMessage('Invalid video format')
    ],
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const errors = validationResult(req)
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() })
            }

            const { user } = req as AuthenticatedRequest
            const { projectId, fileUri, mimeType, contentType, targetDuration, videoFormat } = req.body as QuickClipsRequestBody

            // Verify user owns this project
            const { data: profile, error: profileError } = await supabase
                .from('users')
                .select('id')
                .eq('auth_id', user.id)
                .single()

            if (profileError || !profile) {
                return res.status(500).json({ error: 'Could not load user profile' })
            }

            const { data: project, error: projectError } = await supabase
                .from('projects')
                .select('*')
                .eq('id', projectId)
                .eq('user_id', profile.id)
                .single()

            if (projectError) {
                return res.status(404).json({ error: 'Project not found' })
            }

            // Start background processing (don't await this)
            processQuickClipsAsync({
                projectId,
                fileUri,
                mimeType,
                contentType,
                targetDuration,
                videoFormat,
                originalFilename: project.name
            })

            // Return immediately
            return res.status(200).json({ 
                message: 'Processing started',
                projectId 
            })

        } catch (error) {
            next(error)
        }
    }
)

// Background processing function
async function processQuickClipsAsync(params: QuickClipsRequestBody & { originalFilename: string }) {
    const { projectId, fileUri, contentType, targetDuration, videoFormat } = params

    try {
        // Update status to processing
        await updateProjectStatus(projectId, 'processing', 10, 'Analyzing video content...')

        // Simulate AI processing time
        await new Promise(resolve => setTimeout(resolve, 3000))
        await updateProjectStatus(projectId, 'processing', 30, 'Identifying key moments...')

        await new Promise(resolve => setTimeout(resolve, 3000))
        await updateProjectStatus(projectId, 'processing', 60, 'Generating clips...')

        // Generate mock clips for now
        const clips = generateMockClips(targetDuration, fileUri)

        await new Promise(resolve => setTimeout(resolve, 2000))
        await updateProjectStatus(projectId, 'processing', 90, 'Finalizing clips...')

        // Store clips data in project
        const quickclipsData = {
            clips,
            processingTime: Date.now(),
            originalFilename: params.originalFilename
        }

        await supabase
            .from('projects')
            .update({
                processing_status: 'completed',
                processing_progress: 100,
                processing_message: 'Processing complete!',
                quickclips_data: quickclipsData
            })
            .eq('id', projectId)

        // Send email notification
        await sendEmailNotification(projectId)

    } catch (error) {
        console.error('QuickClips processing error:', error)
        await updateProjectStatus(
            projectId, 
            'error', 
            0, 
            'Processing failed',
            error instanceof Error ? error.message : 'Unknown error'
        )
    }
}

async function updateProjectStatus(
    projectId: string, 
    status: string, 
    progress: number, 
    message: string, 
    errorMessage?: string
) {
    await supabase.rpc('update_project_processing_status', {
        project_id_param: projectId,
        status_param: status,
        progress_param: progress,
        message_param: message,
        error_param: errorMessage
    })
}

function generateMockClips(targetDuration: number, fileUri: string): QuickClip[] {
    return [
        {
            id: 'clip-1',
            title: 'Key Insight Revealed',
            duration: Math.min(targetDuration, 45),
            start_time: 120,
            end_time: 120 + Math.min(targetDuration, 45),
            viral_score: 9,
            description: 'The most important takeaway from this video',
            thumbnail: 'https://via.placeholder.com/320x180?text=Key+Insight',
            downloadUrl: `${fileUri}?clip=1`,
            previewUrl: `${fileUri}?preview=1`
        },
        {
            id: 'clip-2',
            title: 'Actionable Advice',
            duration: Math.min(targetDuration, 60),
            start_time: 300,
            end_time: 300 + Math.min(targetDuration, 60),
            viral_score: 8,
            description: 'Practical tips you can implement today',
            thumbnail: 'https://via.placeholder.com/320x180?text=Actionable+Tips',
            downloadUrl: `${fileUri}?clip=2`,
            previewUrl: `${fileUri}?preview=2`
        },
        {
            id: 'clip-3',
            title: 'Memorable Quote',
            duration: Math.min(targetDuration, 30),
            start_time: 500,
            end_time: 500 + Math.min(targetDuration, 30),
            viral_score: 7,
            description: 'A quote worth sharing',
            thumbnail: 'https://via.placeholder.com/320x180?text=Quote',
            downloadUrl: `${fileUri}?clip=3`,
            previewUrl: `${fileUri}?preview=3`
        }
    ]
}

async function sendEmailNotification(projectId: string) {
    try {
        // Get user email
        const { data: userEmail } = await supabase.rpc('get_user_email_by_project', {
            project_id_param: projectId
        })

        if (!userEmail) {
            console.error('Could not get user email for project:', projectId)
            return
        }

        // Get project details
        const { data: project } = await supabase
            .from('projects')
            .select('name')
            .eq('id', projectId)
            .single()

        if (!project) {
            console.error('Could not get project details:', projectId)
            return
        }

        console.log(`Would send email to ${userEmail}: QuickClips ready for ${project.name}`)
        // TODO: Implement actual email sending
        
    } catch (error) {
        console.error('Error sending email notification:', error)
    }
}

export default router 