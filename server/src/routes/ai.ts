import express from 'express';
import { generateVideoAnalysis, generateAIAssistantResponse } from '../integrations/googleGenAI.js';

const router = express.Router();

console.log('[AI Routes] Router initialized');

// Handle CORS preflight requests
router.options('*', (req, res) => {
    console.log('[AI Routes] OPTIONS request to:', req.path);
    res.header('Access-Control-Allow-Origin', req.headers.origin);
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.sendStatus(200);
});

// Video Analysis endpoint
router.post('/analyze-video', async (req, res) => {
    console.log('[AI Routes] /analyze-video endpoint hit');
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
    console.log('[AI Routes] /assistant endpoint hit with method:', req.method);
    console.log('[AI Routes] Request body keys:', Object.keys(req.body || {}));
    console.log('[AI Routes] Request headers:', Object.keys(req.headers));
    
    try {
        const { prompt, semanticJSON, currentTimeline } = req.body;

        if (!prompt) {
            console.log('[AI Routes] Missing prompt parameter');
            return res.status(400).json({ 
                error: 'Missing required parameter: prompt' 
            });
        }

        console.log('[AI Routes] Processing AI assistant request with prompt length:', prompt.length);
        
        const result = await generateAIAssistantResponse(prompt, semanticJSON, currentTimeline);
        
        console.log('[AI Routes] AI assistant response completed');
        res.json(result);
        
    } catch (error) {
        console.error('[AI Routes] AI assistant API error:', error);
        res.status(500).json({ 
            error: error instanceof Error ? error.message : 'AI assistant request failed' 
        });
    }
});

// Add a test endpoint to verify the router is working
router.get('/test', (req, res) => {
    console.log('[AI Routes] Test endpoint hit');
    res.json({ message: 'AI routes are working', timestamp: new Date().toISOString() });
});

// Add a simple POST test endpoint
router.post('/test-post', (req, res) => {
    console.log('[AI Routes] Test POST endpoint hit');
    res.json({ message: 'POST requests are working', method: req.method, timestamp: new Date().toISOString() });
});

// Catch-all route to debug what requests are reaching this router
router.all('*', (req, res) => {
    console.log('[AI Routes] Catch-all route hit:', req.method, req.path);
    console.log('[AI Routes] Available routes: /analyze-video, /assistant, /test, /test-post');
    res.status(404).json({ 
        error: 'Route not found',
        method: req.method,
        path: req.path,
        availableRoutes: ['/analyze-video', '/assistant', '/test', '/test-post']
    });
});

console.log('[AI Routes] All routes registered');

export default router; 