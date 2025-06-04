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

// Enhanced CORS configuration
const corsOptions = {
    origin: function (origin: string | undefined, callback: Function) {
        // Allow requests with no origin (like mobile apps, Postman, etc.)
        if (!origin) {
            console.log('[CORS] No origin - allowing request')
            return callback(null, true)
        }
        
        console.log('[CORS] Checking origin:', origin)
        
        if (allowedOrigins.includes(origin)) {
            console.log('[CORS] Origin allowed:', origin)
            callback(null, true)
        } else {
            console.log('[CORS] Origin blocked:', origin)
            console.log('[CORS] Allowed origins:', allowedOrigins)
            callback(new Error('Not allowed by CORS'), false)
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    preflightContinue: false,
    optionsSuccessStatus: 200
}

app.use(cors(corsOptions))

// Additional OPTIONS handler for preflight requests
app.options('*', (req, res) => {
    console.log('[PREFLIGHT] Handling preflight request for:', req.url)
    console.log('[PREFLIGHT] Origin:', req.headers.origin)
    res.header('Access-Control-Allow-Origin', req.headers.origin)
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Origin, X-Requested-With')
    res.header('Access-Control-Allow-Credentials', 'true')
    res.sendStatus(200)
})

app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}))
app.use(express.json())
app.use(bodyParser.json())

app.use(morgan('dev'))

// protect everything under /api
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