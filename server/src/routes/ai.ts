import express from 'express';
import { generateVideoAnalysis, generateAIAssistantResponse } from '../integrations/googleGenAI.js';

const router = express.Router();

console.log('[AI Routes] Router initialized');
console.log('[AI Routes] generateVideoAnalysis function:', typeof generateVideoAnalysis);
console.log('[AI Routes] generateAIAssistantResponse function:', typeof generateAIAssistantResponse);

// Add middleware to log all requests to this router
router.use((req, res, next) => {
    console.log(`[AI Router] ${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
    console.log(`[AI Router] Path: ${req.path}`);
    console.log(`[AI Router] Base URL: ${req.baseUrl}`);
    console.log(`[AI Router] Headers:`, {
        'content-type': req.headers['content-type'],
        'authorization': req.headers.authorization ? '[PRESENT]' : '[MISSING]',
        'origin': req.headers.origin
    });
    console.log(`[AI Router] Body size:`, JSON.stringify(req.body || {}).length, 'bytes');
    next();
});
console.log('[AI Routes] generateVideoAnalysis function:', typeof generateVideoAnalysis);
console.log('[AI Routes] generateAIAssistantResponse function:', typeof generateAIAssistantResponse);

// Add middleware to log all requests to this router
router.use((req, res, next) => {
    console.log(`[AI Router] ${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
    console.log(`[AI Router] Path: ${req.path}`);
    console.log(`[AI Router] Base URL: ${req.baseUrl}`);
    console.log(`[AI Router] Headers:`, {
        'content-type': req.headers['content-type'],
        'authorization': req.headers.authorization ? '[PRESENT]' : '[MISSING]',
        'origin': req.headers.origin
    });
    console.log(`[AI Router] Body size:`, JSON.stringify(req.body || {}).length, 'bytes');
    next();
});

// Handle CORS preflight requests for specific routes
router.options('/assistant', (req, res) => {
    console.log('[AI Routes] OPTIONS request to /assistant');
    console.log('[AI Routes] Origin:', req.headers.origin);
    res.header('Access-Control-Allow-Origin', req.headers.origin);
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.sendStatus(200);
});

router.options('/analyze-video', (req, res) => {
    console.log('[AI Routes] OPTIONS request to /analyze-video');
    console.log('[AI Routes] Origin:', req.headers.origin);
    res.header('Access-Control-Allow-Origin', req.headers.origin);
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.sendStatus(200);
});

router.options('/test', (req, res) => {
    console.log('[AI Routes] OPTIONS request to /test');
    console.log('[AI Routes] Origin:', req.headers.origin);
    res.header('Access-Control-Allow-Origin', req.headers.origin);
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.sendStatus(200);
});

// Video Analysis endpoint
router.post('/analyze-video', async (req, res) => {
    console.log('[AI Routes] /analyze-video endpoint hit');
    console.log('[AI Routes] Request method:', req.method);
    console.log('[AI Routes] Request body keys:', Object.keys(req.body || {}));
    
    try {
        const { videoUrl, mimeType, projectId } = req.body;

        console.log('[AI Routes] Video analysis parameters:', {
            hasVideoUrl: !!videoUrl,
            mimeType,
            projectId
        });

        if (!videoUrl || !mimeType) {
            console.log('[AI Routes] Missing required parameters for video analysis');
            return res.status(400).json({ 
                error: 'Missing required parameters: videoUrl and mimeType' 
            });
        }

        console.log('[AI Routes] Starting video analysis for project:', projectId);
        
        const result = await generateVideoAnalysis(videoUrl, mimeType);
        
        console.log('[AI Routes] Video analysis completed successfully');
        console.log('[AI Routes] Result keys:', Object.keys(result || {}));
        res.json(result);
        
    } catch (error) {
        console.error('[AI Routes] Video analysis API error:', error);
        console.error('[AI Routes] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
        res.status(500).json({ 
            error: error instanceof Error ? error.message : 'Video analysis failed' 
        });
    }
});

// AI Assistant endpoint - THE CRITICAL ONE
router.post('/assistant', async (req, res) => {
    console.log('=== [AI Routes] /assistant endpoint hit ===');
    console.log('[AI Routes] Timestamp:', new Date().toISOString());
    console.log('[AI Routes] Request method:', req.method);
    console.log('[AI Routes] Request URL:', req.originalUrl);
    console.log('[AI Routes] Request path:', req.path);
    console.log('[AI Routes] Base URL:', req.baseUrl);
    console.log('[AI Routes] Request body keys:', Object.keys(req.body || {}));
    console.log('[AI Routes] Request headers keys:', Object.keys(req.headers));
    console.log('[AI Routes] Content-Type:', req.headers['content-type']);
    console.log('[AI Routes] Authorization present:', !!req.headers.authorization);
    console.log('[AI Routes] User object present:', !!(req as any).user);
    
    try {
        const { prompt, semanticJSON, currentTimeline } = req.body;

        console.log('[AI Routes] Assistant request parameters:', {
            hasPrompt: !!prompt,
            promptLength: prompt?.length || 0,
            hasSemanticJSON: !!semanticJSON,
            hasCurrentTimeline: !!currentTimeline,
            semanticJSONKeys: semanticJSON ? Object.keys(semanticJSON) : [],
            timelineKeys: currentTimeline ? Object.keys(currentTimeline) : []
        });

        if (!prompt) {
            console.log('[AI Routes] Missing prompt parameter');
            return res.status(400).json({ 
                error: 'Missing required parameter: prompt' 
            });
        }

        console.log('[AI Routes] Processing AI assistant request with prompt:', prompt.substring(0, 100) + '...');
        console.log('[AI Routes] Calling generateAIAssistantResponse function...');
        
        // Check if the function exists
        if (typeof generateAIAssistantResponse !== 'function') {
            console.error('[AI Routes] generateAIAssistantResponse is not a function!');
            console.error('[AI Routes] Type:', typeof generateAIAssistantResponse);
            return res.status(500).json({
                error: 'AI assistant function not available'
            });
        }
        
        const result = await generateAIAssistantResponse(prompt, semanticJSON, currentTimeline);
        
        console.log('[AI Routes] AI assistant response completed successfully');
        console.log('[AI Routes] Result type:', typeof result);
        console.log('[AI Routes] Result keys:', Object.keys(result || {}));
        
        if (!result) {
            console.error('[AI Routes] No result returned from generateAIAssistantResponse');
            return res.status(500).json({
                error: 'No response from AI assistant'
            });
        }
        
        res.json(result);
        console.log('[AI Routes] Response sent successfully');
        
    } catch (error) {
        console.error('=== [AI Routes] AI assistant API error ===');
        console.error('[AI Routes] Error type:', typeof error);
        console.error('[AI Routes] Error message:', error instanceof Error ? error.message : 'Unknown error');
        console.error('[AI Routes] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
        console.error('[AI Routes] Error details:', error);
        
        const errorMessage = error instanceof Error ? error.message : 'AI assistant request failed';
        const statusCode = error instanceof Error && error.message.includes('401') ? 401 : 500;
        
        res.status(statusCode).json({ 
            error: errorMessage,
            timestamp: new Date().toISOString(),
            endpoint: '/assistant'
        });
    }
});

// Add a test endpoint to verify the router is working
router.get('/test', (req, res) => {
    console.log('[AI Routes] GET /test endpoint hit');
    console.log('[AI Routes] Request method:', req.method);
    console.log('[AI Routes] Request path:', req.path);
    res.json({ 
        message: 'AI routes are working', 
        timestamp: new Date().toISOString(),
        method: req.method,
        path: req.path,
        originalUrl: req.originalUrl
    });
});

// Add a simple POST test endpoint
router.post('/test-post', (req, res) => {
    console.log('[AI Routes] POST /test-post endpoint hit');
    console.log('[AI Routes] Request method:', req.method);
    console.log('[AI Routes] Request body:', req.body);
    res.json({ 
        message: 'POST requests are working', 
        method: req.method, 
        timestamp: new Date().toISOString(),
        body: req.body
    });
});

// Add a catch-all route for debugging unmatched paths
router.use('*', (req, res, next) => {
    console.log('[AI Routes] Unmatched route in AI router:', req.method, req.originalUrl);
    console.log('[AI Routes] Available routes: /assistant, /analyze-video, /test, /test-post');
    next(); // Let it fall through to 404
});

console.log('[AI Routes] All routes registered');
console.log('[AI Routes] Available routes:');
console.log('[AI Routes] - POST /assistant');
console.log('[AI Routes] - POST /analyze-video');
console.log('[AI Routes] - GET /test');
console.log('[AI Routes] - POST /test-post');

export default router; 