import { useState, useEffect, useRef } from 'react';
import LemonaLogo from '../common/LemonaLogo';
import LogoutButton from '../ui/buttons/LogoutButton';
import AuthButton from '../ui/buttons/AuthButton';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';

declare global {
    interface Window {
        tf: any;
    }
}

export default function HomeNavbar() {
    const { user, profile, signIn, signOut } = useAuth()
    const router = useRouter()
    const pathname = usePathname()
    const [isDropdownOpen, setIsDropdownOpen] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)

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

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [])

    const handleSignIn = () => {
        signIn()
        router.push('/projects')
    }

    const handleSignOut = () => {
        signOut()
        setIsDropdownOpen(false)
        console.log('signing out')
    }

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 shadow-sm">
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
                            <a 
                                href="/" 
                                className={`text-gray-600 hover:text-gray-900 transition-colors duration-200 font-medium relative ${
                                    pathname === '/' ? 'text-gray-900' : ''
                                }`}
                            >
                                Home
                                {pathname === '/' && (
                                    <div className="absolute -bottom-1 -left-1 -right-1 h-0.5 bg-blue-400 rounded-full"></div>
                                )}
                            </a>
                            <a 
                                href="/projects" 
                                className={`text-gray-600 hover:text-gray-900 transition-colors duration-200 font-medium relative ${
                                    pathname === '/projects' ? 'text-gray-900' : ''
                                }`}
                            >
                                Projects
                                {pathname === '/projects' && (
                                    <div className="absolute -bottom-1 -left-2 -right-2 h-0.5 bg-blue-300 rounded-full"></div>
                                )}
                            </a>
                            <a 
                                href="/pricing" 
                                className={`text-gray-600 hover:text-gray-900 transition-colors duration-200 font-medium relative ${
                                    pathname === '/pricing' ? 'text-gray-900' : ''
                                }`}
                            >
                                Pricing
                                {pathname === '/pricing' && (
                                    <div className="absolute -bottom-1 -left-2 -right-2 h-0.5 bg-blue-300 rounded-full"></div>
                                )}
                            </a>
                            <a 
                                href="https://x.com/lemona_labs" 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-gray-600 hover:text-gray-900 transition-colors duration-200 font-medium"
                            >
                                Twitter
                            </a>
                        </div>

                        {/* Auth Section */}
                        {user ? (
                            <div className="relative" ref={dropdownRef}>
                                {/* Profile Avatar Button */}
                                <button
                                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                    className="flex items-center justify-center w-10 h-10 rounded-full hover:ring-2 hover:ring-blue-500 hover:ring-offset-2 transition-all duration-200"
                                >
                                    {profile?.avatar_url ? (
                                        <img
                                            src={profile.avatar_url}
                                            alt={`${profile.full_name}'s avatar`}
                                            className="w-10 h-10 rounded-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 via-teal-500 to-emerald-400 rounded-full flex items-center justify-center">
                                            <span className="text-white text-sm font-semibold">
                                                {profile?.email?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase()}
                                            </span>
                                        </div>
                                    )}
                                </button>

                                {/* Dropdown Menu */}
                                {isDropdownOpen && (
                                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                                        {/* User Info */}
                                        <div className="px-4 py-3 border-b border-gray-100">
                                            <div className="flex items-center space-x-3">
                                                {profile?.avatar_url ? (
                                                    <img
                                                        src={profile.avatar_url}
                                                        alt={`${profile.full_name}'s avatar`}
                                                        className="w-8 h-8 rounded-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 via-teal-500 to-emerald-400 rounded-full flex items-center justify-center">
                                                        <span className="text-white text-xs font-semibold">
                                                            {profile?.email?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase()}
                                                        </span>
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    {profile?.full_name && (
                                                        <p className="text-sm font-medium text-gray-900 truncate">
                                                            {profile.full_name}
                                                        </p>
                                                    )}
                                                    <p className="text-sm text-gray-500 truncate">
                                                        {profile?.email || user.email}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Logout Button */}
                                        <button
                                            onClick={handleSignOut}
                                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-200"
                                        >
                                            Sign Out
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <button
                                className="flex items-center space-x-2 font-bold bg-gradient-to-r from-blue-500 via-teal-500 to-emerald-400 hover:from-blue-600 hover:via-teal-600 hover:to-emerald-500 text-white px-4 py-2 rounded-lg transition-all duration-200 font-medium shadow-lg hover:shadow-xl"
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