import { Request, Response, NextFunction } from 'express'
import { supabase } from '../config/supabaseClient'

export interface AuthenticatedRequest extends Request {
    user: any
}

export async function authenticate(
    req: Request,
    res: Response,
    next: NextFunction
) {
    const header = req.headers.authorization
    const token = header?.split(' ')[1]
    if (!token) {
        res.status(401).json({ error: 'No token' })
        return
    }

    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) {
        res.status(401).json({})
        return
    }

    // Upsert into public.users
    const { error: upsertError } = await supabase
        .from('users')
        .upsert({
            auth_id: user.id,
            email: user.email,
            full_name: user.user_metadata.name,
            avatar_url: user.user_metadata.picture,
            last_login_at: new Date().toISOString(),
        })
        .eq('auth_id', user.id)

    if (upsertError) {
        console.error('Failed to upsert profile:', upsertError)
        // but *do not* abort auth; we can still proceed
    }

    // Attach user and continue
    (req as AuthenticatedRequest).user = user
    next()
}
