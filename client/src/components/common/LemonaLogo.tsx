import React from 'react';
import { useRouter } from 'next/navigation';

const LemonaLogo = () => {
    const router = useRouter()

    return (
        <button
            onClick={() => router.push('/')}
            className="flex items-center gap-3 group transition-all duration-200 hover:opacity-80"
        >
            <img
                src="/assets/main/lemona-icon.png"
                alt="Lemona Icon"
                className="w-8 h-8 transition-transform duration-200 group-hover:scale-105"
            />
            <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent tracking-tight">
                Lemona
            </span>
        </button>
    )
}

export default LemonaLogo