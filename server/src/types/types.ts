import { Request } from 'express'
import { User } from '@supabase/supabase-js'

export interface AuthenticatedRequest extends Request {
    user: User
} 