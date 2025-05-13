import express from 'express'
import dotenv from 'dotenv'
import helmet from 'helmet'
import cors from 'cors'

import { authenticate } from './middleware/authenticate'
import { updateLastLogin } from './middleware/updateLastLogin'
import { json } from 'body-parser'
import apiRouter from './api'
import morgan from 'morgan'

dotenv.config();

const {
    ALLOWED_ORIGINS,
    PORT,
} = process.env

const app = express()

app.use(cors({ origin: ALLOWED_ORIGINS }))
app.use(helmet())
app.use(express.json())
app.use(json())

app.use(morgan('dev'))

// protect everything under /api
app.use(
    '/api/v1',
    authenticate,
    updateLastLogin,
    apiRouter
)

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
