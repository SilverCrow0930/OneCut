import React, { useEffect } from 'react'
import LemonaLogo from '../common/LemonaLogo'
import AuthButton from '../ui/buttons/AuthButton'
import LogoutButton from '../ui/buttons/LogoutButton'
import { useAuth } from '@/contexts/AuthContext'

const Navbar = () => {
    const { user, signIn, signOut } = useAuth()

    const handleSignIn = () => {
        signIn()
        console.log('signing in')
    }

    const handleSignOut = () => {
        signOut()
        console.log('signing out')
    }

    // useEffect(() => {
    //     console.log('user', user)
    // }, [user])

    return (
        <div className="
            flex flex-row w-full items-center justify-between
            bg-black/40 rounded-lg
            border border-white border-opacity-20
            px-6 py-4
        ">
            <LemonaLogo />
            {
                user ? (
                    <LogoutButton
                        onClick={handleSignOut}
                    />
                ) : (
                    <button
                        className="
                            flex flex-row items-center gap-2
                            bg-gradient-to-r from-blue-600 to-purple-600
                            hover:from-blue-700 hover:to-purple-700
                            text-white px-6 py-3 rounded-2xl
                            transition-all duration-300
                            shadow-lg hover:shadow-xl
                            transform hover:scale-105 active:scale-95
                            font-medium
                        "
                        onClick={handleSignIn}
                    >
                        <img
                            src="/assets/icons/google.png"
                            alt="Google"
                            className="w-5 h-5"
                        />
                        Sign in with Google
                    </button>
                )
            }
        </div>
    )
}

export default Navbar