import express from 'express';
import { generateVideoAnalysis, generateAIAssistantResponse } from '../integrations/googleGenAI.js';

const router = express.Router();

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
router.post('/assistant', async (req, res) => {
    try {
        console.log('=== AI ASSISTANT ENDPOINT HIT ===');
        console.log('Method:', req.method);
        console.log('URL:', req.url);
        console.log('Headers:', req.headers);
        console.log('Body:', req.body);
        
        const { prompt, semanticJSON, currentTimeline } = req.body;

        if (!prompt) {
            console.log('Missing prompt parameter');
            return res.status(400).json({ 
                error: 'Missing required parameter: prompt' 
            });
        }

        console.log('Processing AI assistant request with prompt:', prompt.substring(0, 100));
        
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
    console.log('=== AI TEST ENDPOINT HIT ===');
    res.json({ message: 'AI routes are working', timestamp: new Date().toISOString() });
});

export default router; 