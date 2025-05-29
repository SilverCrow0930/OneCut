import React from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

const HomeFirstSection = () => {
    const router = useRouter()
    const { user, signIn } = useAuth()

    const handleJoinBeta = () => {
        if (user) {
            router.push('/creation')
        } else {
            signIn()
        }
    }

    return (
        <div className="
            flex flex-col w-full h-screen items-center justify-center overflow-hidden
        ">
            <div className="flex flex-col items-center justify-center gap-6 px-4">
                {/* Logo */}
                <div className="flex flex-col items-center justify-center gap-2">
                    <img
                        src="/assets/main/lemona-icon.png"
                        alt="logo"
                        className="w-24 h-24 md:w-32 md:h-32"
                    />
                </div>

                {/* Title */}
                <div className="
                    flex flex-col items-center justify-center gap-2
                    text-2xl sm:text-3xl md:text-4xl lg:text-6xl text-white font-[600]
                    text-center
                ">
                    <p>
                        The First AI Content Creator
                    </p>
                </div>

                {/* Description */}
                <div className="flex flex-col items-center justify-center gap-1">
                    <p className="text-sm sm:text-base md:text-lg lg:text-xl text-gray-200 text-center">
                        <span className="hidden sm:inline">The AI video co-pilot that takes you from nothing</span>
                        <span className="sm:hidden">The AI video co-pilot that takes you from</span>
                    </p>
                    <p className="text-sm sm:text-base md:text-lg lg:text-xl text-gray-200 text-center">
                        <span className="hidden sm:inline">to viral-ready content.</span>
                        <span className="sm:hidden">nothing to viral-ready content.</span>
                    </p>
                </div>

                {/* Button */}
                <button className="
                    bg-blue-500 hover:bg-blue-600 mt-2
                    text-white font-semibold text-base sm:text-lg md:text-xl
                    px-6 sm:px-8 md:px-12 py-3 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl 
                    active:transform active:scale-95 cursor-pointer
                "
                    onClick={handleJoinBeta}
                >
                    {user ? 'Start the Journey' : 'Sign In to Start'}
                </button>
            </div>
        </div>
    )
}

export default HomeFirstSection