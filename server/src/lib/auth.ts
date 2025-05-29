import { supabase } from '../config/supabaseClient.js'

export async function getLocalUserId(supabaseUserId: string): Promise<string> {
    // Get or create local user
    const { data: user, error } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', supabaseUserId)
        .single()

    if (error) {
        throw error
    }

    return user.id
} 