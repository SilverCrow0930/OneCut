import React, {
    createContext,
    useContext,
    useEffect,
    useState,
    ReactNode
} from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Session, User } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { apiPath } from '@/lib/config'
import FreeCreditsAnimation from '@/components/ui/FreeCreditsAnimation'

dotenv.config()

export interface Profile {
    id: string
    auth_id: string
    email: string
    full_name: string | null
    avatar_url: string | null
    last_login_at: string | null
    created_at: string
    updated_at: string
}

interface AuthContextType {
    user: User | null
    session: Session | null
    profile: Profile | null
    signIn: () => void
    signOut: () => Promise<void>
    isLoading: boolean
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    session: null,
    profile: null,
    signIn: () => { },
    signOut: async () => { },
    isLoading: true
})

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null)
    const [session, setSession] = useState<Session | null>(null)
    const [profile, setProfile] = useState<Profile | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isNewUser, setIsNewUser] = useState(false)
    const [showCreditsAnimation, setShowCreditsAnimation] = useState(false)
    
    // Track last login time to detect new users
    const [lastLoginTime, setLastLoginTime] = useState<string | null>(null)

    // 1) On mount, load existing session & subscribe to changes
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session)
            setUser(session?.user ?? null)
            setIsLoading(false)
        })

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_, newSession) => {
                setSession(newSession)
                setUser(newSession?.user ?? null)
                setIsLoading(false)
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
            .then((data: Profile) => {
                setProfile(data)
                
                // Check if this is a new user by comparing created_at and last_login_at
                const createdAt = new Date(data.created_at).getTime()
                const lastLogin = data.last_login_at ? new Date(data.last_login_at).getTime() : null
                
                // If this is the first login or login happened within 30 seconds of account creation
                const isFirstLogin = !lastLoginTime && lastLogin
                
                if (isFirstLogin) {
                    // Store the current login time
                    setLastLoginTime(data.last_login_at)
                    
                    // If created_at and last_login_at are very close (within 30 seconds),
                    // this is likely a new user who just registered
                    const isNewAccount = lastLogin && (lastLogin - createdAt < 30000)
                    
                    if (isNewAccount) {
                        console.log('New user detected! Showing free credits animation.')
                        setIsNewUser(true)
                        setShowCreditsAnimation(true)
                        
                        // Store in localStorage that we've shown the animation to this user
                        try {
                            localStorage.setItem(`credits_animation_shown_${data.id}`, 'true')
                        } catch (err) {
                            console.warn('Failed to store animation state in localStorage:', err)
                        }
                    }
                }
            })
            .catch(err => {
                console.error('Failed to load profile:', err)
                setProfile(null)
            })
    }, [session, lastLoginTime])

    const signIn = async () => {
        try {
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/projects`
                }
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
            isLoading
        }}>
            {children}
            {showCreditsAnimation && (
                <FreeCreditsAnimation 
                    onClose={() => setShowCreditsAnimation(false)}
                    autoClose={true}
                    autoCloseTime={15000}
                />
            )}
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