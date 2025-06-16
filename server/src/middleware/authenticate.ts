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
    console.log('=== [Auth] Authentication middleware started ===');
    console.log('[Auth] Timestamp:', new Date().toISOString());
    console.log('[Auth] Request:', req.method, req.originalUrl);
    console.log('[Auth] Path:', req.path);
    console.log('[Auth] Base URL:', req.baseUrl);
    
    const authHeader = req.headers.authorization
    const token = authHeader?.split(' ')[1]
    
    console.log('[Auth] Auth header present:', !!authHeader);
    console.log('[Auth] Auth header value:', authHeader ? authHeader.substring(0, 20) + '...' : 'none');
    console.log('[Auth] Token present:', !!token);
    console.log('[Auth] Token length:', token?.length || 0);
    
    if (!token) {
        console.log('[Auth] Missing token, returning 401');
        console.log('[Auth] This will cause a 401 Unauthorized response');
        return res.status(401).json({ error: 'Missing token' });
    }

    console.log('[Auth] Calling supabase.auth.getUser with token...');
    
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser(token)

    console.log('[Auth] Supabase auth response:', {
        hasUser: !!user,
        hasError: !!authError,
        errorMessage: authError?.message,
        userId: user?.id,
        userEmail: user?.email
    });

    if (authError || !user) {
        console.log('[Auth] Invalid token, error:', authError?.message);
        console.log('[Auth] This will cause a 401 Unauthorized response');
        return res.status(401).json({ error: 'Invalid token' })
    }

    console.log('[Auth] User authenticated successfully:', user.email);

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
    console.log('=== [Auth] Authentication middleware completed successfully ===');
    next()
}