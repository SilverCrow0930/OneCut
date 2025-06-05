import { useState, useEffect } from 'react';
import LemonaLogo from '../common/LemonaLogo';
import LogoutButton from '../ui/buttons/LogoutButton';
import AuthButton from '../ui/buttons/AuthButton';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

declare global {
    interface Window {
        tf: any;
    }
}

export default function HomeNavbar() {
    const { user, signIn, signOut } = useAuth()
    const router = useRouter()

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
        router.push('/creation')
    }

    const handleSignOut = () => {
        signOut()
        console.log('signing out')
    }

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-md border-b border-gray-800">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* Logo */}
                    <div className="flex-shrink-0">
                        <LemonaLogo />
                    </div>

                    {/* Navigation and Actions */}
                    <div className="flex items-center space-x-8">
                        {/* Navigation Links */}
                        <div className="hidden md:flex items-center space-x-8">
                            <a href="#" className="text-gray-300 hover:text-white transition-colors duration-200 font-medium">
                                Product
                            </a>
                            <a href="/pricing" className="text-gray-300 hover:text-white transition-colors duration-200 font-medium">
                                Pricing
                            </a>
                            <a 
                                href="https://x.com/lemona_labs" 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-gray-300 hover:text-white transition-colors duration-200 font-medium"
                            >
                                Twitter
                            </a>
                        </div>

                        {/* Auth Section */}
                        {user ? (
                            <div className="flex items-center space-x-4">
                                <div className="flex items-center space-x-3">
                                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                                        <span className="text-white text-sm font-semibold">
                                            {user.email?.charAt(0).toUpperCase()}
                                        </span>
                                    </div>
                                    <span className="text-gray-300 text-sm font-medium hidden sm:block">
                                        {user.email}
                                    </span>
                                </div>
                                <button
                                    onClick={handleSignOut}
                                    className="text-gray-300 hover:text-white transition-colors duration-200 font-medium"
                                >
                                    Sign Out
                                </button>
                            </div>
                        ) : (
                            <button
                                className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 font-medium"
                                onClick={handleSignIn}
                            >
                                <img
                                    src="/assets/icons/google.png"
                                    alt="Google"
                                    className="w-4 h-4"
                                />
                                <span>Sign In</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
}