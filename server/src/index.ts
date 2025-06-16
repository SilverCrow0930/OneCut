import express from 'express'
import dotenv from 'dotenv'
import helmet from 'helmet'
import cors from 'cors'
import bodyParser from 'body-parser'
import morgan from 'morgan'
import http from 'http'

import { authenticate } from './middleware/authenticate.js'
import { updateLastLogin } from './middleware/updateLastLogin.js'
import apiRouter from './api/index.js'
import geminiAiRouter from './routes/ai.js'
import { setupWebSocket } from './websocket/index.js'

dotenv.config();

const {
    ALLOWED_ORIGINS,
    PORT = '8080',
    NODE_ENV = 'development'
} = process.env

console.log('[STARTUP] Environment variables check:');
console.log('[STARTUP] NODE_ENV:', NODE_ENV);
console.log('[STARTUP] PORT:', PORT);
console.log('[STARTUP] GEMINI_API_KEY present:', !!process.env.GEMINI_API_KEY);
console.log('[STARTUP] ALLOWED_ORIGINS:', ALLOWED_ORIGINS);

const app = express()

// Configure CORS based on environment
const productionOrigins = [
    'https://lemona.studio', 
    'https://www.lemona.studio', 
    'https://lemona-app.onrender.com'
]

const allowedOrigins = NODE_ENV === 'production'
    ? [...productionOrigins, ...(ALLOWED_ORIGINS?.split(',').filter(Boolean) || [])]
    : ['http://localhost:3000']

console.log('[CORS] Environment:', NODE_ENV)
console.log('[CORS] Allowed origins:', allowedOrigins)

const corsOptions = {
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    exposedHeaders: ['Content-Range', 'X-Content-Range']
}
app.use(cors(corsOptions))
app.use(helmet())

// Increase body parser limits to handle large caption data
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ limit: '10mb', extended: true }))
app.use(bodyParser.json({ limit: '10mb' }))

app.use(morgan('dev'))

// Add comprehensive request logging middleware
app.use((req, res, next) => {
    console.log(`[REQUEST] ${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
    console.log(`[REQUEST] Headers:`, {
        'content-type': req.headers['content-type'],
        'authorization': req.headers.authorization ? '[PRESENT]' : '[MISSING]',
        'origin': req.headers.origin,
        'user-agent': req.headers['user-agent']?.substring(0, 50) + '...'
    });
    next();
});

// Add test routes before protected routes
app.get('/health', (req, res) => {
    console.log('[Server] Health check hit');
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        environment: NODE_ENV 
    });
});

// Add a test route for AI assistant without authentication
app.post('/api/ai/test-direct', (req, res) => {
    console.log('[Server] Direct AI test route hit');
    res.json({ 
        message: 'Direct AI route working',
        method: req.method,
        body: req.body,
        timestamp: new Date().toISOString()
    });
});

// Add route debugging for AI endpoints (using regex pattern instead of wildcard)
app.use(/^\/api\/ai/, (req, res, next) => {
    console.log(`[AI ROUTE DEBUG] ${req.method} ${req.originalUrl}`);
    console.log(`[AI ROUTE DEBUG] Path: ${req.path}`);
    console.log(`[AI ROUTE DEBUG] Base URL: ${req.baseUrl}`);
    console.log(`[AI ROUTE DEBUG] Route params:`, req.params);
    console.log(`[AI ROUTE DEBUG] Query params:`, req.query);
    console.log(`[AI ROUTE DEBUG] Body keys:`, Object.keys(req.body || {}));
    next();
});

console.log('[Server] Test routes added');

// Check router imports before mounting
console.log('[ROUTER CHECK] apiRouter type:', typeof apiRouter);
console.log('[ROUTER CHECK] geminiAiRouter type:', typeof geminiAiRouter);
console.log('[ROUTER CHECK] apiRouter is function:', typeof apiRouter === 'function');
console.log('[ROUTER CHECK] geminiAiRouter is function:', typeof geminiAiRouter === 'function');

if (!apiRouter) {
    console.error('[ROUTER ERROR] apiRouter is undefined!');
}
if (!geminiAiRouter) {
    console.error('[ROUTER ERROR] geminiAiRouter is undefined!');
}

// protect everything under /api
app.use(
    '/api/v1',
    (req, res, next) => {
        console.log(`[API V1] Request: ${req.method} ${req.path}`);
        next();
    },
    authenticate,
    updateLastLogin,
    apiRouter
)

console.log('[Server] API v1 routes mounted at /api/v1');

// AI routes (protected) with enhanced debugging
app.use(
    '/api/ai',
    (req, res, next) => {
        console.log(`[AI MIDDLEWARE] Pre-auth: ${req.method} ${req.path}`);
        console.log(`[AI MIDDLEWARE] Full URL: ${req.originalUrl}`);
        next();
    },
    authenticate,
    (req, res, next) => {
        console.log(`[AI MIDDLEWARE] Post-auth: ${req.method} ${req.path}`);
        console.log(`[AI MIDDLEWARE] User authenticated:`, !!(req as any).user);
        next();
    },
    geminiAiRouter
)

console.log('[Server] AI routes mounted at /api/ai');

// EMERGENCY: Add direct route registration as backup
console.log('[EMERGENCY] Adding direct route registration as backup...');

// Import the AI function directly for emergency route
import { generateAIAssistantResponse } from './integrations/googleGenAI.js';

// EMERGENCY: Direct route registration bypassing the router
app.post('/api/ai/assistant-direct', authenticate, async (req, res) => {
    console.log('=== [EMERGENCY DIRECT] /assistant-direct endpoint hit ===');
    console.log('[EMERGENCY DIRECT] This bypasses the router completely');
    console.log('[EMERGENCY DIRECT] Request method:', req.method);
    console.log('[EMERGENCY DIRECT] Request body keys:', Object.keys(req.body || {}));
    
    try {
        const { prompt, semanticJSON, currentTimeline } = req.body;

        if (!prompt) {
            console.log('[EMERGENCY DIRECT] Missing prompt parameter');
            return res.status(400).json({ 
                error: 'Missing required parameter: prompt' 
            });
        }

        console.log('[EMERGENCY DIRECT] Processing AI assistant request...');
        
        // Check if the function exists
        if (typeof generateAIAssistantResponse !== 'function') {
            console.error('[EMERGENCY DIRECT] generateAIAssistantResponse is not a function!');
            return res.status(500).json({
                error: 'AI assistant function not available'
            });
        }
        
        const result = await generateAIAssistantResponse(prompt, semanticJSON, currentTimeline);
        
        console.log('[EMERGENCY DIRECT] AI assistant response completed successfully');
        res.json(result);
        
    } catch (error) {
        console.error('[EMERGENCY DIRECT] AI assistant API error:', error);
        res.status(500).json({ 
            error: error instanceof Error ? error.message : 'AI assistant request failed' 
        });
    }
});

// EMERGENCY: Test route without authentication
app.get('/api/ai/test-no-auth', (req, res) => {
    console.log('[EMERGENCY] Test route without auth hit');
    res.json({
        message: 'Emergency test route working (no auth)',
        timestamp: new Date().toISOString(),
        method: req.method,
        path: req.path
    });
});

console.log('[EMERGENCY] Direct routes added:');
console.log('[EMERGENCY] - POST /api/ai/assistant-direct (with auth)');
console.log('[EMERGENCY] - GET /api/ai/test-no-auth (no auth)');

// Add a catch-all route to debug unmatched requests (using function instead of wildcard)
app.use((req, res, next) => {
    // Only log if it's not a static file request
    if (!req.path.includes('.') && !req.path.startsWith('/_next')) {
        console.log(`[CATCH-ALL] Unmatched route: ${req.method} ${req.originalUrl}`);
        console.log(`[CATCH-ALL] Available routes should include /api/ai/assistant`);
    }
    
    // Don't actually handle the request, let it fall through to 404
    next();
});

// Add debug route to list all registered routes
app.get('/debug/routes', (req, res) => {
    console.log('[DEBUG] Route listing requested');
    
    try {
        // Simple route listing without complex regex parsing to avoid path-to-regexp issues
        const simpleRoutes = [
            { path: '/health', methods: ['GET'], description: 'Health check' },
            { path: '/api/ai/assistant', methods: ['POST'], description: 'AI Assistant endpoint' },
            { path: '/api/ai/analyze-video', methods: ['POST'], description: 'Video analysis' },
            { path: '/api/ai/test', methods: ['GET'], description: 'AI test endpoint' },
            { path: '/api/ai/test-post', methods: ['POST'], description: 'AI POST test' },
            { path: '/api/v1/*', methods: ['*'], description: 'API v1 routes (protected)' },
            { path: '/debug/routes', methods: ['GET'], description: 'This debug endpoint' }
        ];
        
        console.log('[DEBUG] Returning simplified route list');
        
        res.json({
            message: 'Available routes (simplified to avoid path-to-regexp issues)',
            routes: simpleRoutes,
            timestamp: new Date().toISOString(),
            totalRoutes: simpleRoutes.length,
            note: 'This is a simplified list. The server should have these routes available.'
        });
    } catch (error) {
        console.error('[DEBUG] Error in route debug endpoint:', error);
        res.status(500).json({
            error: 'Failed to list routes',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

const server = http.createServer(app);
setupWebSocket(server);

server.listen(
    PORT,
    () => {
        console.log(`[SERVER] Server listening on port ${PORT}`);
        console.log(`[SERVER] Environment: ${NODE_ENV}`);
        console.log(`[SERVER] CORS origins:`, allowedOrigins);
        console.log(`[SERVER] Routes should be available at:`);
        console.log(`[SERVER] - GET /health`);
        console.log(`[SERVER] - POST /api/ai/assistant`);
        console.log(`[SERVER] - GET /debug/routes`);
    }
)