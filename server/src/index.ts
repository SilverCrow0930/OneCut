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

// protect everything under /api
app.use(
    '/api/v1',
    authenticate,
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