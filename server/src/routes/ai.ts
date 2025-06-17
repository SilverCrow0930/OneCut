import express from 'express';
import { generateVideoAnalysis, generateAIAssistantResponse } from '../integrations/googleGenAI.js';
import { supabase } from '../config/supabaseClient.js';

const router = express.Router();

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