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

            // 3) Get timeline data (clips and assets)
            const { data: clips, error: clipsError } = await supabase
                .from('clips')
                .select(`
                    id, asset_id, timeline_start_ms, timeline_end_ms, 
                    source_start_ms, source_end_ms, type
                `)
                .in('track_id', 
                    supabase
                        .from('tracks')
                        .select('id')
                        .eq('project_id', projectId)
                )
                .eq('type', 'video')
                .order('timeline_start_ms', { ascending: true })

            if (clipsError) {
                return res.status(500).json({ error: 'Failed to fetch clips' })
            }

            if (!clips || clips.length === 0) {
                return res.status(400).json({ error: 'No video clips found in project' })
            }

            console.log('📹 Found', clips.length, 'video clips for processing')

            // 4) Get asset information
            const assetIds = clips.map((clip: any) => clip.asset_id).filter(Boolean)
            const { data: assets, error: assetsError } = await supabase
                .from('assets')
                .select('id, object_key, mime_type')
                .in('id', assetIds)
                .eq('user_id', profile.id)

            if (assetsError || !assets) {
                return res.status(500).json({ error: 'Failed to fetch assets' })
            }

            console.log('📁 Found', assets.length, 'assets for processing')

            // 5) Extract and combine audio
            const combinedAudioUrl = await extractAndCombineAudio(clips, assets, user.id)
            console.log('🎵 Combined audio created:', combinedAudioUrl)

            // 6) Generate captions using Gemini
            console.log('🤖 Sending audio to Gemini for transcription...')
            const aiCaptions = await generateCaptions(combinedAudioUrl, 'audio/wav')
            console.log('✅ Received', aiCaptions.length, 'captions from Gemini')

            // 7) Map AI timestamps to project timeline
            const mappedCaptions = mapCaptionsToTimeline(aiCaptions, clips)
            console.log('🗺️ Mapped captions to project timeline')

            // 8) Clear existing captions for this project
            await supabase
                .from('captions')
                .delete()
                .eq('project_id', projectId)

            // 9) Insert new captions
            if (mappedCaptions.length > 0) {
                const { error: insertError } = await supabase
                    .from('captions')
                    .insert(
                        mappedCaptions.map(caption => ({
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

            console.log('💾 Saved', mappedCaptions.length, 'captions to database')

            // 10) Clean up temporary audio file
            try {
                if (combinedAudioUrl.startsWith('file://')) {
                    const filePath = combinedAudioUrl.replace('file://', '')
                    fs.unlinkSync(filePath)
                    console.log('🗑️ Cleaned up temporary audio file')
                }
            } catch (cleanupError) {
                console.warn('Failed to clean up temporary file:', cleanupError)
            }

            return res.json({
                success: true,
                captions: mappedCaptions,
                message: `Generated ${mappedCaptions.length} captions successfully`
            })

        } catch (err) {
            console.error('Caption generation error:', err)
            next(err)
        }
    }
)

// Helper function to extract and combine audio from video clips
async function extractAndCombineAudio(
    clips: any[], 
    assets: any[], 
    userId: string
): Promise<string> {
    const tempDir = os.tmpdir()
    const outputPath = path.join(tempDir, `combined_audio_${uuid()}.wav`)
    
    try {
        // Create FFmpeg filter complex for combining audio
        const inputArgs: string[] = []
        const filterParts: string[] = []
        
        for (let i = 0; i < clips.length; i++) {
            const clip = clips[i]
            const asset = assets.find(a => a.id === clip.asset_id)
            
            if (!asset) {
                console.warn(`Asset not found for clip ${clip.id}`)
                continue
            }
            
            // Download video file from GCS
            const tempVideoPath = path.join(tempDir, `video_${i}_${uuid()}.tmp`)
            const file = bucket.file(asset.object_key)
            
            await new Promise<void>((resolve, reject) => {
                const writeStream = fs.createWriteStream(tempVideoPath)
                file.createReadStream()
                    .pipe(writeStream)
                    .on('error', reject)
                    .on('finish', resolve)
            })
            
            inputArgs.push('-i', tempVideoPath)
            
            // Calculate timing for this clip
            const sourceStart = clip.source_start_ms / 1000
            const sourceDuration = (clip.source_end_ms - clip.source_start_ms) / 1000
            
            // Extract audio segment with timing
            filterParts.push(
                `[${i}:a]atrim=start=${sourceStart}:duration=${sourceDuration},asetpts=PTS-STARTPTS[a${i}]`
            )
        }
        
        if (filterParts.length === 0) {
            throw new Error('No valid clips found for audio extraction')
        }
        
        // Combine all audio segments
        const concatInputs = filterParts.map((_, i) => `[a${i}]`).join('')
        const filterComplex = filterParts.join(';') + `;${concatInputs}concat=n=${filterParts.length}:v=0:a=1[out]`
        
        // Run FFmpeg command
        const ffmpegArgs = [
            ...inputArgs,
            '-filter_complex', filterComplex,
            '-map', '[out]',
            '-ac', '1', // Mono audio
            '-ar', '16000', // 16kHz sample rate for speech recognition
            '-y', // Overwrite output
            outputPath
        ]
        
        await new Promise<void>((resolve, reject) => {
            console.log('🔧 Running FFmpeg with args:', ffmpegArgs.join(' '))
            
            const ffmpeg = spawn('ffmpeg', ffmpegArgs)
            
            ffmpeg.stderr.on('data', (data) => {
                // Log FFmpeg progress/errors
                console.log('FFmpeg:', data.toString())
            })
            
            ffmpeg.on('close', (code) => {
                if (code === 0) {
                    resolve()
                } else {
                    reject(new Error(`FFmpeg exited with code ${code}`))
                }
            })
            
            ffmpeg.on('error', reject)
        })
        
        // Clean up temporary video files
        for (let i = 0; i < clips.length; i++) {
            const tempVideoPath = path.join(tempDir, `video_${i}_${uuid()}.tmp`)
            try {
                fs.unlinkSync(tempVideoPath)
            } catch (e) {
                // Ignore cleanup errors
            }
        }
        
        return `file://${outputPath}`
        
    } catch (error) {
        console.error('Audio extraction failed:', error)
        throw new Error(`Failed to extract audio: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
}

// Helper function to map AI captions to project timeline
function mapCaptionsToTimeline(
    aiCaptions: Array<{ start_ms: number, end_ms: number, text: string, confidence: number }>,
    clips: any[]
): Array<{ start_ms: number, end_ms: number, text: string, confidence: number }> {
    // For now, map AI timestamps directly to project timeline
    // This assumes the combined audio preserves the timeline structure
    
    return aiCaptions.map(caption => ({
        start_ms: Math.round(caption.start_ms),
        end_ms: Math.round(caption.end_ms),
        text: caption.text,
        confidence: caption.confidence
    }))
}

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

            // Update caption with ownership check via project
            const { data, error } = await supabase
                .from('captions')
                .update({ text, start_ms, end_ms })
                .eq('id', id)
                .in('project_id', 
                    supabase
                        .from('projects')
                        .select('id')
                        .eq('user_id', 
                            supabase
                                .from('users')
                                .select('id')
                                .eq('auth_id', user.id)
                        )
                )
                .select('*')
                .single()

            if (error) {
                return res.status(500).json({ error: error.message })
            }

            if (!data) {
                return res.status(404).json({ error: 'Caption not found' })
            }

            return res.json(data)
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

            // Delete caption with ownership check via project
            const { error } = await supabase
                .from('captions')
                .delete()
                .eq('id', id)
                .in('project_id', 
                    supabase
                        .from('projects')
                        .select('id')
                        .eq('user_id', 
                            supabase
                                .from('users')
                                .select('id')
                                .eq('auth_id', user.id)
                        )
                )

            if (error) {
                return res.status(500).json({ error: error.message })
            }

            return res.sendStatus(204)
        } catch (err) {
            next(err)
        }
    }
)

export default router 