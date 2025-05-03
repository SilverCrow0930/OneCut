import dotenv from 'dotenv'

dotenv.config()

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000'

export {
    FRONTEND_URL
}