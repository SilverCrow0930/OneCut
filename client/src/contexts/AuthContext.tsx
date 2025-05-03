import React, {
    createContext,
    useContext,
    useEffect,
    useState,
    ReactNode
} from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Session, User } from '@supabase/supabase-js'
import { Profile } from '@/types/users'
import dotenv from 'dotenv'
import { apiPath } from '@/lib/config'

dotenv.config()

interface AuthContextType {
    user: User | null
    session: Session | null
    profile: Profile | null
    signIn: () => void
    signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    session: null,
    profile: null,
    signIn: () => { },
    signOut: async () => { },
})

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null)
    const [session, setSession] = useState<Session | null>(null)
    const [profile, setProfile] = useState<Profile | null>(null)

    // 1) On mount, load existing session & subscribe to changes
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session)
            setUser(session?.user ?? null)
        })

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_, newSession) => {
                setSession(newSession)
                setUser(newSession?.user ?? null)
            }
        )
        return () => {
            subscription.unsubscribe()
        }
    }, [])

    // 2) Whenever session updates, fetch your DB profile
    useEffect(() => {
        if (!session?.access_token) {
            setProfile(null)
            return
        }

        fetch(apiPath('/auth/me'), {
            headers: { Authorization: `Bearer ${session.access_token}` },
        })
            .then(async res => {
                if (!res.ok) throw new Error(await res.text())
                return res.json()
            })
            .then((data: Profile) => setProfile(data))
            .catch(err => {
                console.error('Failed to load profile:', err)
                setProfile(null)
            })
    }, [session])

    const signIn = async () => {
        try {
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google'
            })

            if (error) {
                console.error('[Auth] signIn error:', error)
                return
            }

            if (data?.url) {
                // this is the authorize endpoint on Supabase
                window.location.href = data.url
            }
        }
        catch (error) {
            console.error('[Auth] signIn error:', error)
        }
    }

    const signOut = async () => {
        await supabase.auth.signOut()
    }

    return (
        <AuthContext.Provider value={{
            user,
            session,
            profile,
            signIn,
            signOut,
        }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (!context) {
        throw new Error('useAuth must be inside AuthProvider')
    }
    return context
}