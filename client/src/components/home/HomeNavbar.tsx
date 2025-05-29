import { useState, useEffect } from 'react';
import LemonaLogo from '../common/LemonaLogo';
import LogoutButton from '../ui/buttons/LogoutButton';
import AuthButton from '../ui/buttons/AuthButton';
import { useAuth } from '@/contexts/AuthContext';

declare global {
    interface Window {
        tf: any;
    }
}

export default function HomeNavbar() {
    const { user, signIn, signOut } = useAuth()

    useEffect(() => {
        // Load Typeform embed script
        const script = document.createElement('script');
        script.src = '//embed.typeform.com/next/embed.js';
        script.async = true;
        document.body.appendChild(script);

        return () => {
            document.body.removeChild(script);
        };
    }, []);

    const handleSignIn = () => {
        signIn()
        console.log('signing in')
    }

    const handleSignOut = () => {
        signOut()
        console.log('signing out')
    }

    return (
        <nav className="absolute top-4 left-0 flex items-center justify-center w-full px-4 md:px-6 py-4">
            <div className="flex flex-row items-center justify-between w-full md:w-[80%]">

                {/* Logo */}
                <LemonaLogo />

                <div
                    className="flex flex-row items-center gap-4 md:gap-10"
                >
                    {/* Navigation Links */}
                    <div className="hidden md:flex items-center space-x-8">
                        <a href="#" className="text-white hover:text-gray-300 transition-colors">Product</a>
                        <a href="#" className="text-white hover:text-gray-300 transition-colors">Pricing</a>
                        <a href="#" className="text-white hover:text-gray-300 transition-colors">Contact</a>
                    </div>
                    {
                        user ? (
                            <LogoutButton
                                onClick={handleSignOut}
                            />
                        ) : (
                            <button
                                className="
                                    flex flex-row items-center gap-2
                                    bg-white/20 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-2xl
                                    hover:bg-white/30 transition-all duration-300
                                    text-sm sm:text-base
                                "
                                onClick={handleSignIn}
                            >
                                <img
                                    src="/assets/icons/google.png"
                                    alt="google"
                                    className="w-5 h-5 sm:w-6 sm:h-6"
                                />
                                Sign In
                            </button>
                        )
                    }
                </div>
            </div>
        </nav>
    );
}