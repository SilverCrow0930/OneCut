import express from 'express'
import dotenv from 'dotenv'
import helmet from 'helmet'
import cors from 'cors'
import rateLimit from 'express-rate-limit'

import { authenticate } from './middleware/authenticate'
import { updateLastLogin } from './middleware/updateLastLogin'
import { json } from 'body-parser'
import apiRouter from './api'

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

// rate limiting
app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
}))

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
