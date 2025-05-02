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

    useEffect(() => {
        console.log('user', user)
    }, [user])

    return (
        <div className="
            flex flex-row w-full items-center justify-between
            bg-black/40 rounded-lg
            border-2 border-white border-opacity-20
            px-6 py-2
        ">
            <LemonaLogo />
            {
                user ? (
                    <LogoutButton
                        onClick={handleSignOut}
                    />
                ) : (
                    <AuthButton
                        onClick={handleSignIn}
                    />
                )
            }
        </div>
    )
}

export default Navbar