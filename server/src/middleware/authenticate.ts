import { Request, Response, NextFunction } from 'express'
import { supabase } from '../config/supabaseClient.js'

export interface AuthenticatedRequest extends Request {
    user: {
        id: string
        email: string
        user_metadata: {
            name?: string;
            picture?: string;
        }
    }
}

export async function authenticate(
    req: Request,
    res: Response,
    next: NextFunction
) {
    console.log('[Auth] Authenticating request to:', req.method, req.path);
    
    const authHeader = req.headers.authorization
    const token = authHeader?.split(' ')[1]
    
    console.log('[Auth] Auth header present:', !!authHeader);
    console.log('[Auth] Token present:', !!token);
    
    if (!token) {
        console.log('[Auth] Missing token, returning 401');
        return res.status(401).json({ error: 'Missing token' });
    }

    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
        console.log('[Auth] Invalid token, error:', authError?.message);
        return res.status(401).json({ error: 'Invalid token' })
    }

    console.log('[Auth] User authenticated:', user.email);

    // Upsert (insert-or-update) the profile under service key:
    const now = new Date().toISOString()
    const { error: upsertError } = await supabase
        .from('users')
        .upsert(
            {
                auth_id: user.id,
                email: user.email,
                full_name: user.user_metadata?.name,
                avatar_url: user.user_metadata?.picture,
                last_login_at: now,
                updated_at: now,
            },
            {
                onConflict: 'auth_id'
            }
        )

    if (upsertError) {
        console.error('Failed to upsert profile:', upsertError)
        // Don't block auth if upsert fails
    }

    // Attach the Supabase user object to the request
    ; (req as AuthenticatedRequest).user = {
        id: user.id,
        email: user.email as string,
        user_metadata: user.user_metadata,
    }
    
    console.log('[Auth] Authentication successful, proceeding to next middleware');
    next()
}