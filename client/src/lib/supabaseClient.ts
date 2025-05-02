import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
}

// console.log('[Supabase] Initializing client with URL:', supabaseUrl)
// console.log('[Supabase] Using anon key:', supabaseAnonKey)

export const supabase = createClient(
    supabaseUrl,
    supabaseAnonKey
)

// console.log('[Supabase] Client initialized successfully')