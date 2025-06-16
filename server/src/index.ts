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

console.log('[Server] Test routes added');

// protect everything under /api
app.use(
    '/api/v1',
    authenticate,
    updateLastLogin,
    apiRouter
)

console.log('[Server] API v1 routes mounted at /api/v1');

// AI routes (protected)
app.use(
    '/api/ai',
    authenticate,
    aiRouter
)

console.log('[Server] AI routes mounted at /api/ai');

const server = http.createServer(app);
setupWebSocket(server);

server.listen(
    PORT,
    () => console.log(`Server listening on port ${PORT}`)
)