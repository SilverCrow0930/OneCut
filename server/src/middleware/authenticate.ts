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
    const authHeader = req.headers.authorization
    const token = authHeader?.split(' ')[1]
    if (!token) return res.status(401).json({ error: 'Missing token' })

    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
        return res.status(401).json({ error: 'Invalid token' })
    }

    // Check if user already exists to determine if this is a new user
    const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', user.id)
        .single()
    
    const isNewUser = !existingUser

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

    // If this is a new user, give them 20 free credits
    if (isNewUser) {
        // Get the internal user ID after upsert
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('auth_id', user.id)
            .single()
        
        if (userData && !userError) {
            // Check if user already has credits (double-check to prevent duplicates)
            const { data: existingCredits } = await supabase
                .from('user_credits')
                .select('id')
                .eq('user_id', userData.id)
                .single()
            
            if (!existingCredits) {
                console.log(`New user detected (${user.email}). Adding 20 free credits.`)
                
                const { error: creditsError } = await supabase
                    .from('user_credits')
                    .insert({
                        user_id: userData.id,
                        current_credits: 20, // Give 20 free credits
                        ai_assistant_chats: 0,
                        last_reset_at: now
                    })
                
                if (creditsError) {
                    console.error('Failed to add free credits for new user:', creditsError)
                    // Don't block auth if credits initialization fails
                }
            }
        }
    }

    // Attach the Supabase user object to the request
    ; (req as AuthenticatedRequest).user = {
        id: user.id,
        email: user.email as string,
        user_metadata: user.user_metadata,
    }
    next()
}