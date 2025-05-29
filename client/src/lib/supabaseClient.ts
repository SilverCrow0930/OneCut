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
    supabaseAnonKey,
    {
        auth: {
            persistSession: true,
            storageKey: 'lemona-auth-token',
            storage: {
                getItem: (key) => {
                    if (typeof window === 'undefined') return null
                    return window.localStorage.getItem(key)
                },
                setItem: (key, value) => {
                    if (typeof window === 'undefined') return
                    window.localStorage.setItem(key, value)
                },
                removeItem: (key) => {
                    if (typeof window === 'undefined') return
                    window.localStorage.removeItem(key)
                }
            }
        }
    }
)

// console.log('[Supabase] Client initialized successfully')