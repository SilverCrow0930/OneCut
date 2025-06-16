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

// Add route debugging for AI endpoints
app.use('/api/ai*', (req, res, next) => {
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

// Add a catch-all route to debug unmatched requests
app.use('*', (req, res, next) => {
    console.log(`[CATCH-ALL] Unmatched route: ${req.method} ${req.originalUrl}`);
    console.log(`[CATCH-ALL] Available routes should include /api/ai/assistant`);
    
    // Don't actually handle the request, let it fall through to 404
    next();
});

// Add debug route to list all registered routes
app.get('/debug/routes', (req, res) => {
    console.log('[DEBUG] Route listing requested');
    
    const routes: any[] = [];
    
    function extractRoutes(stack: any[], prefix = '') {
        stack.forEach((layer: any) => {
            if (layer.route) {
                const methods = Object.keys(layer.route.methods);
                routes.push({
                    path: prefix + layer.route.path,
                    methods: methods,
                    name: layer.route.stack[0]?.name || 'anonymous'
                });
            } else if (layer.name === 'router' && layer.handle?.stack) {
                let routerPrefix = '';
                try {
                    routerPrefix = layer.regexp.source
                        .replace(/\\\//g, '/')
                        .replace(/\$.*/, '')
                        .replace(/^\^/, '')
                        .replace(/\?\(\?\:/, '')
                        .replace(/\)/, '');
                } catch (e) {
                    routerPrefix = '[complex-pattern]';
                }
                extractRoutes(layer.handle.stack, prefix + routerPrefix);
            }
        });
    }
    
    try {
        extractRoutes(app._router.stack);
        console.log('[DEBUG] Found routes:', routes.length);
        
        res.json({
            message: 'Available routes',
            routes: routes,
            timestamp: new Date().toISOString(),
            totalRoutes: routes.length
        });
    } catch (error) {
        console.error('[DEBUG] Error extracting routes:', error);
        res.status(500).json({
            error: 'Failed to extract routes',
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