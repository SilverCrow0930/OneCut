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
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true)
        } else {
            console.log('[CORS] Rejected origin:', origin)
            callback(new Error('Not allowed by CORS'))
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'Origin',
        'Access-Control-Request-Method',
        'Access-Control-Request-Headers'
    ],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    preflightContinue: false,
    optionsSuccessStatus: 204
}

// Apply CORS before other middleware
app.use(cors(corsOptions))

// Security middleware
app.use(helmet({
    crossOriginResourcePolicy: {
        policy: 'cross-origin'
    },
    crossOriginOpenerPolicy: {
        policy: 'same-origin-allow-popups'
    }
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