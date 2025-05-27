import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface LogoutButtonProps {
    onClick: () => void;
}

export default function LogoutButton({ onClick }: LogoutButtonProps) {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const { profile } = useAuth();
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Avatar Button */}
            <button
                className={`
                    relative overflow-hidden
                    w-12 h-12 rounded-full
                    border-2 border-white/20
                    transform transition-all duration-300 ease-in-out
                    hover:border-white/40 hover:scale-105
                `}
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
                {profile?.avatar_url ? (
                    <img
                        src={profile.avatar_url}
                        alt={`${profile.full_name}'s avatar`}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center text-white font-medium">
                        {profile?.full_name?.[0]?.toUpperCase() || '?'}
                    </div>
                )}
            </button>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
                <div className="
                    absolute right-0 mt-3 min-w-[220px] w-56
                    bg-white rounded-xl shadow-xl
                    border border-gray-200
                    overflow-hidden
                    z-50
                    p-0
                ">
                    <div className="p-4 border-b border-gray-100">
                        <p className="font-bold text-base text-gray-900 leading-tight">{profile?.full_name}</p>
                        <p className="text-xs text-gray-500 truncate" title={profile?.email}>{profile?.email}</p>
                    </div>
                    <button
                        className="
                            w-full flex items-center gap-2
                            px-4 py-3
                            text-left text-red-600 text-base font-semibold
                            hover:bg-red-50
                            transition-colors duration-200
                        "
                        onClick={() => {
                            onClick();
                            setIsDropdownOpen(false);
                        }}
                    >
                        <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                            />
                        </svg>
                        Logout
                    </button>
                </div>
            )}
        </div>
    );
}