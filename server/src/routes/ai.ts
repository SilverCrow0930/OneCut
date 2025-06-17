import express from 'express';
import multer from 'multer';
import { generateVideoAnalysis, generateVideoAnalysisFromBlob, generateAIAssistantResponse } from '../integrations/googleGenAI.js';
import { supabase } from '../config/supabaseClient.js';

const router = express.Router();

// Configure multer for video uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 500 * 1024 * 1024 // 500MB limit
    }
});

// Add debugging middleware
router.use((req, res, next) => {
    console.log(`[AI Routes] ${req.method} ${req.path} - Headers:`, req.headers);
    console.log(`[AI Routes] Body:`, req.body);
    next();
});

// Video Analysis endpoint
router.post('/analyze-video', async (req, res) => {
    try {
        console.log('[AI Routes] Video analysis endpoint hit');
        const { videoUrl, mimeType, projectId } = req.body;

        if (!videoUrl || !mimeType) {
            return res.status(400).json({ 
                error: 'Missing required parameters: videoUrl and mimeType' 
            });
        }

        if (!projectId) {
            return res.status(400).json({ 
                error: 'Project ID is required' 
            });
        }

        console.log('Starting video analysis for project:', projectId);
        
        const result = await generateVideoAnalysis(videoUrl, mimeType);
        
        // Save the analysis to the database
        const { error: dbError } = await supabase
            .from('video_analyses')
            .upsert({
                project_id: projectId,
                analysis_data: result,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'project_id'
            });

        if (dbError) {
            console.error('Failed to save video analysis to database:', dbError);
            // Still return the result even if DB save fails
        } else {
            console.log('Video analysis saved to database for project:', projectId);
        }
        
        console.log('Video analysis completed successfully');
        res.json(result);
        
    } catch (error) {
        console.error('Video analysis API error:', error);
        res.status(500).json({ 
            error: error instanceof Error ? error.message : 'Video analysis failed' 
        });
    }
});

// Video Analysis endpoint for blob uploads
router.post('/analyze-video-blob', upload.single('video'), async (req, res) => {
    try {
        console.log('[AI Routes] Video blob analysis endpoint hit');
        const { mimeType, projectId } = req.body;
        const videoFile = req.file;

        if (!videoFile) {
            return res.status(400).json({ 
                error: 'No video file provided' 
            });
        }

        if (!mimeType) {
            return res.status(400).json({ 
                error: 'MIME type is required' 
            });
        }

        if (!projectId) {
            return res.status(400).json({ 
                error: 'Project ID is required' 
            });
        }

        console.log('Starting video blob analysis for project:', projectId);
        console.log('Video file details:', {
            originalName: videoFile.originalname,
            mimeType: videoFile.mimetype,
            size: videoFile.size,
            sizeMB: (videoFile.size / (1024 * 1024)).toFixed(2)
        });
        
        // Create a blob from the buffer
        const videoBlob = new Blob([videoFile.buffer], { type: mimeType });
        
        // Create a temporary URL for the blob (this won't work for Gemini, so we'll modify the function)
        const result = await generateVideoAnalysisFromBlob(videoBlob, mimeType);
        
        // Save the analysis to the database
        const { error: dbError } = await supabase
            .from('video_analyses')
            .upsert({
                project_id: projectId,
                analysis_data: result,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'project_id'
            });

        if (dbError) {
            console.error('Failed to save video analysis to database:', dbError);
            // Still return the result even if DB save fails
        } else {
            console.log('Video analysis saved to database for project:', projectId);
        }
        
        console.log('Video blob analysis completed successfully');
        res.json(result);
        
    } catch (error) {
        console.error('Video blob analysis API error:', error);
        res.status(500).json({ 
            error: error instanceof Error ? error.message : 'Video analysis failed' 
        });
    }
});

// Get existing video analysis
router.get('/video-analysis/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;

        if (!projectId) {
            return res.status(400).json({ 
                error: 'Project ID is required' 
            });
        }

        const { data, error } = await supabase
            .from('video_analyses')
            .select('analysis_data')
            .eq('project_id', projectId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                // No analysis found
                return res.status(404).json({ 
                    error: 'No video analysis found for this project' 
                });
            }
            throw error;
        }

        res.json(data.analysis_data);
        
    } catch (error) {
        console.error('Error fetching video analysis:', error);
        res.status(500).json({ 
            error: error instanceof Error ? error.message : 'Failed to fetch video analysis' 
        });
    }
});

// AI Assistant endpoint
router.post('/assistant', async (req, res) => {
    try {
        console.log('[AI Routes] Assistant endpoint hit');
        const { prompt, semanticJSON, currentTimeline } = req.body;

        if (!prompt) {
            return res.status(400).json({ 
                error: 'Missing required parameter: prompt' 
            });
        }

        console.log('Processing AI assistant request:', prompt);
        
        const result = await generateAIAssistantResponse(prompt, semanticJSON, currentTimeline);
        
        console.log('AI assistant response completed');
        res.json(result);
        
    } catch (error) {
        console.error('AI assistant API error:', error);
        res.status(500).json({ 
            error: error instanceof Error ? error.message : 'AI assistant request failed' 
        });
    }
});

// Add a test endpoint to verify routing
router.get('/test', (req, res) => {
    console.log('[AI Routes] Test endpoint hit');
    res.json({ message: 'AI routes are working!', timestamp: new Date().toISOString() });
});

// Add a simple assistant test endpoint without authentication
router.post('/assistant-test', (req, res) => {
    console.log('[AI Routes] Assistant test endpoint hit');
    res.json({ 
        message: 'Assistant endpoint is reachable!', 
        receivedBody: req.body,
        timestamp: new Date().toISOString() 
    });
});

export default router; 