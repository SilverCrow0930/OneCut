import express from 'express'
import dotenv from 'dotenv'
import helmet from 'helmet'
import cors, { CorsOptions } from 'cors'
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
console.log('[CORS] PORT:', PORT)
console.log('[CORS] ALLOWED_ORIGINS env var:', ALLOWED_ORIGINS)
console.log('[CORS] Production origins:', productionOrigins)
console.log('[CORS] Final allowed origins:', allowedOrigins)

const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.error('[CORS] Request blocked for origin:', origin);
            console.error('[CORS] Allowed origins:', allowedOrigins);
            callback(new Error('Not allowed by CORS'));
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
        'Access-Control-Allow-Headers',
        'Access-Control-Request-Method',
        'Access-Control-Request-Headers'
    ],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    optionsSuccessStatus: 200, // for legacy browser support
    preflightContinue: false
}

// Debug middleware to log all requests
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} from origin: ${req.headers.origin || 'no-origin'}`)
    next()
})

// Apply CORS middleware FIRST
app.use(cors(corsOptions))

// Additional explicit preflight handling
app.options('*', cors(corsOptions))

// Then other middleware
app.use(helmet({
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
}))
app.use(express.json())
app.use(bodyParser.json())
app.use(morgan('dev'))

// Add a simple health check endpoint that doesn't require auth
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        origin: req.headers.origin || 'no-origin'
    })
})

// Add a CORS test endpoint that doesn't require auth
app.get('/api/v1/cors-test', (req, res) => {
    res.json({ 
        message: 'CORS working', 
        origin: req.headers.origin || 'no-origin',
        timestamp: new Date().toISOString()
    })
})

// Add a database test endpoint
app.get('/api/v1/db-test', async (req, res) => {
    try {
        const { supabase } = await import('./config/supabaseClient.js')
        
        // Test 1: Check projects table structure
        const { data: tableInfo, error: tableError } = await supabase
            .from('projects')
            .select('*')
            .limit(1)
        
        if (tableError) {
            return res.json({
                status: 'error',
                tableError: tableError,
                message: 'Projects table access failed'
            })
        }
        
        res.json({
            status: 'ok',
            tableAccess: 'working',
            sampleColumns: tableInfo?.[0] ? Object.keys(tableInfo[0]) : 'no data',
            timestamp: new Date().toISOString()
        })
    } catch (error) {
        res.status(500).json({
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
        })
    }
})

// Add Socket.IO endpoint test
app.get('/socket.io/test', (req, res) => {
    res.json({
        status: 'Socket.IO endpoint reachable',
        timestamp: new Date().toISOString(),
        origin: req.headers.origin || 'no-origin'
    })
})

// protect everything under /api except the test endpoint
app.use(
    '/api/v1',
    (req, res, next) => {
        // Skip auth for cors-test endpoint
        if (req.path === '/cors-test') {
            return next()
        }
        return authenticate(req, res, next)
    },
    updateLastLogin,
    apiRouter
)

const server = http.createServer(app);
setupWebSocket(server);

server.listen(
    PORT,
    () => console.log(`Server listening on port ${PORT}`)
)