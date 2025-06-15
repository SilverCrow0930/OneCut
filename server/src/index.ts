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
import aiRouter from './routes/ai.js'
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

// Always allow production origins, plus any additional ones from env
const allowedOrigins = [
    ...productionOrigins,
    ...(ALLOWED_ORIGINS?.split(',').filter(Boolean) || [])
]

// Add localhost only in development
if (NODE_ENV === 'development') {
    allowedOrigins.push('http://localhost:3000')
}

console.log('[CORS] Environment:', NODE_ENV)
console.log('[CORS] Allowed origins:', allowedOrigins)

const corsOptions = {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true)
        
        if (allowedOrigins.includes(origin)) {
            return callback(null, true)
        }
        
        console.log('[CORS] Blocked origin:', origin)
        return callback(new Error('Not allowed by CORS'))
    },
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

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: NODE_ENV,
        port: PORT,
        allowedOrigins: allowedOrigins
    })
})

// Google GenAI Assistant routes (protected)
console.log('[Server] Mounting Google GenAI Assistant routes at /api/assistant');
app.use(
    '/api/assistant',
    authenticate,
    aiRouter
)

// protect everything under /api
console.log('[Server] Mounting main API routes at /api/v1');
app.use(
    '/api/v1',
    authenticate,
    updateLastLogin,
    apiRouter
)

const server = http.createServer(app);
setupWebSocket(server);

server.listen(
    PORT,
    () => console.log(`Server listening on port ${PORT}`)
)