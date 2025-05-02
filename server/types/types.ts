import { User as SupabaseUser } from '@supabase/supabase-js'

export interface AuthenticatedRequest extends Request {
    user: SupabaseUser
}