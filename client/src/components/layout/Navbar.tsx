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
                            bg-gradient-to-r from-blue-500 to-purple-600
                            hover:from-blue-600 hover:to-purple-700
                            text-white px-6 py-3 rounded-2xl
                            font-medium shadow-lg hover:shadow-xl
                            transform transition-all duration-300
                            hover:scale-105 active:scale-95
                        "
                        onClick={handleSignIn}
                    >
                        <img
                            src="/assets/icons/google.png"
                            alt="google"
                            className="w-6 h-6"
                        />
                        Sign In with Google
                    </button>
                )
            }
        </div>
    )
}

export default Navbar