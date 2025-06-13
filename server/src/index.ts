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
import { setupWebSocket } from './websocket/index.js'

dotenv.config();

const {
    ALLOWED_ORIGINS,
    PORT = '8080',
    NODE_ENV = 'development'
} = process.env

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
console.log('[CORS] ALLOWED_ORIGINS env var:', ALLOWED_ORIGINS)
console.log('[CORS] PORT:', PORT)

const corsOptions = {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true)
        
        if (allowedOrigins.includes(origin)) {
            callback(null, true)
        } else {
            console.log('[CORS] Blocked origin:', origin)
            callback(new Error('Not allowed by CORS'), false)
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
        'Content-Type', 
        'Authorization', 
        'Accept', 
        'Origin', 
        'X-Requested-With',
        'Access-Control-Request-Method',
        'Access-Control-Request-Headers'
    ],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    optionsSuccessStatus: 200, // Some legacy browsers choke on 204
    preflightContinue: false
}

// Apply CORS before any other middleware
app.use(cors(corsOptions))

// Handle preflight requests explicitly
app.options('*', cors(corsOptions))

// Configure helmet to not interfere with CORS
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}))

// Increase body parser limits to handle large caption data
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ limit: '10mb', extended: true }))
app.use(bodyParser.json({ limit: '10mb' }))

app.use(morgan('dev'))

// Add debugging middleware for CORS issues
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`)
    console.log('Origin:', req.headers.origin)
    console.log('User-Agent:', req.headers['user-agent'])
    next()
})

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        environment: NODE_ENV,
        cors: {
            allowedOrigins,
            requestOrigin: req.headers.origin
        }
    })
})

// Handle OPTIONS requests before authentication
app.options('/api/v1/*', cors(corsOptions))

// protect everything under /api (except OPTIONS requests)
app.use(
    '/api/v1',
    (req, res, next) => {
        // Skip authentication for OPTIONS requests (CORS preflight)
        if (req.method === 'OPTIONS') {
            return next()
        }
        authenticate(req, res, next)
    },
    updateLastLogin,
    apiRouter
)

// Global error handling middleware - must be after all routes
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Global error handler:', {
        error: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        timestamp: new Date().toISOString()
    })

    // Don't leak error details in production
    const isDevelopment = process.env.NODE_ENV === 'development'
    
    res.status(err.status || 500).json({
        error: isDevelopment ? err.message : 'Internal server error',
        ...(isDevelopment && { stack: err.stack })
    })
})

// Handle 404 for API routes
app.use('/api/*', (req: express.Request, res: express.Response) => {
    res.status(404).json({ error: 'API endpoint not found' })
})

const server = http.createServer(app);
setupWebSocket(server);

server.listen(
    PORT,
    () => console.log(`Server listening on port ${PORT}`)
)