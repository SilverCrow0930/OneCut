import express from 'express';
import { generateVideoAnalysis, generateAIAssistantResponse } from '../integrations/googleGenAI.js';

const router = express.Router();

// Add debugging middleware
router.use((req, res, next) => {
    console.log(`[AI Routes] ${req.method} ${req.path}`, {
        body: req.body ? Object.keys(req.body) : 'no body',
        headers: req.headers['content-type']
    });
    next();
});

// Video Analysis endpoint
router.post('/analyze-video', async (req, res) => {
    try {
        const { videoUrl, mimeType, projectId } = req.body;

        if (!videoUrl || !mimeType) {
            return res.status(400).json({ 
                error: 'Missing required parameters: videoUrl and mimeType' 
            });
        }

        console.log('Starting video analysis for project:', projectId);
        
        const result = await generateVideoAnalysis(videoUrl, mimeType);
        
        console.log('Video analysis completed successfully');
        res.json(result);
        
    } catch (error) {
        console.error('Video analysis API error:', error);
        res.status(500).json({ 
            error: error instanceof Error ? error.message : 'Video analysis failed' 
        });
    }
});

// AI Assistant endpoint
router.post('/', async (req, res) => {
    console.log('[AI Assistant] Processing request');
    try {
        const { prompt, semanticJSON, currentTimeline } = req.body;

        if (!prompt) {
            console.log('[AI Assistant] Missing prompt parameter');
            return res.status(400).json({ 
                error: 'Missing required parameter: prompt' 
            });
        }

        console.log('[AI Assistant] Processing AI assistant request with prompt:', prompt.substring(0, 100));
        
        const result = await generateAIAssistantResponse(prompt, semanticJSON, currentTimeline);
        
        console.log('[AI Assistant] AI assistant response completed');
        res.json(result);
        
    } catch (error) {
        console.error('[AI Assistant] AI assistant API error:', error);
        res.status(500).json({ 
            error: error instanceof Error ? error.message : 'AI assistant request failed' 
        });
    }
});

export default router; 