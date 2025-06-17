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

// Add test route before authentication to debug routing
app.get('/api/ai/health', (req, res) => {
    console.log('[Server] Health check endpoint hit');
    res.json({ 
        status: 'ok', 
        message: 'AI routes are accessible',
        timestamp: new Date().toISOString() 
    });
});

app.post('/api/ai/test-post', (req, res) => {
    console.log('[Server] Test POST endpoint hit');
    res.json({ 
        status: 'ok', 
        message: 'POST requests are working',
        body: req.body,
        timestamp: new Date().toISOString() 
    });
});

// protect everything under /api
app.use(
    '/api/v1',
    authenticate,
    updateLastLogin,
    apiRouter
)

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