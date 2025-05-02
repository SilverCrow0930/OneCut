import { NextFunction, Response, Request } from "express"
import { supabase } from "../config/supabaseClient"
import { AuthenticatedRequest } from "./authenticate"

export async function updateLastLogin(
    req: Request,
    res: Response,
    next: NextFunction
) {
    const authReq = req as unknown as AuthenticatedRequest
    try {
        await supabase
            .from('users')
            .update({ last_login_at: new Date().toISOString() })
            .eq('auth_id', authReq.user.id)
        next()
    }
    catch (error) {
        console.error('Error updating last login:', error)
        next()
    }
}  