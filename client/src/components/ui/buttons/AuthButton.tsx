import { useState } from 'react';

interface AuthButtonProps {
    onClick: () => void;
}

export default function AuthButton({ onClick }: AuthButtonProps) {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <button
            className={`
                relative overflow-hidden
                px-8 py-3 rounded-full
                bg-gradient-to-r from-purple-500 to-indigo-600
                text-white font-medium text-lg
                shadow-lg cursor-pointer
                transform transition-all duration-300 ease-in-out
                ${isHovered ? 'scale-105 shadow-xl' : ''}
            `}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={onClick}
        >
            <span className="relative z-10 flex items-center justify-center">
                <svg
                    className="w-5 h-5 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                    />
                </svg>
                Sign In / Sign Up
            </span>

            {/* Animated background glow */}
            <span
                className={`
                    absolute inset-0 
                    bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500
                    opacity-0 transition-opacity duration-300 ease-in-out
                    ${isHovered ? 'opacity-80' : ''}
                `}
            />

            {/* Animated shine effect */}
            <span
                className={`
                    absolute top-0 left-0 w-full h-full
                    bg-gradient-to-r from-transparent via-white to-transparent
                    opacity-20
                    transform transition-transform duration-700 ease-in-out
                    ${isHovered ? 'translate-x-full' : '-translate-x-full'}
                `}
            />
        </button>
    );
}