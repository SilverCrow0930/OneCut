import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const {
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY,
} = process.env

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Missing Supabase env vars')
}

export const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY
)