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
} = process.env

const app = express()

app.use(cors({ origin: ALLOWED_ORIGINS }))
app.use(helmet())
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