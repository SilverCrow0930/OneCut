import React from 'react'
import { useRouter } from 'next/navigation'

const HomeFirstSection = () => {
    const router = useRouter()
    return (
        <div className="
            flex flex-col w-full h-screen items-center justify-center
        ">
            <div className="flex flex-col items-center justify-center gap-6">

                {/* Logo */}
                <div className="flex flex-col items-center justify-center gap-2">
                    <img
                        src="/assets/main/lemona-icon.png"
                        alt="logo"
                        className="w-24 h-24 md:w-32 md:h-32"
                    />
                </div>

                <div className="flex flex-col items-center justify-center gap-4 px-2 sm:px-4">
                    {/* Title */}
                    <h1 className="
                        flex flex-col items-center justify-center 
                        text-3xl sm:text-4xl md:text-5xl lg:text-7xl text-white font-[600]
                        text-center whitespace-nowrap
                    ">
                        <p>
                            Effortless Video Creation
                        </p>
                        <p>
                            with AI in Minutes
                        </p>
                    </h1>

                    {/* Description */}
                    <div className="flex flex-col items-center justify-center gap-1">
                        <p className="text-base sm:text-md md:text-lg lg:text-2xl text-gray-200 text-center">
                            <span className="hidden sm:inline">The first AI video co-pilot that takes you from nothing to</span>
                            <span className="sm:hidden">The first AI video co-pilot that takes you from</span>
                        </p>
                        <p className="text-base sm:text-md md:text-lg lg:text-2xl text-gray-200 text-center">
                            <span className="hidden sm:inline">viral-ready content.</span>
                            <span className="sm:hidden">nothing to viral-ready content.</span>
                        </p>
                    </div>
                </div>

                {/* Button */}
                <button className="
                    bg-blue-500 hover:bg-blue-600 mt-2
                    text-white font-semibold text-base sm:text-lg md:text-xl
                    px-6 sm:px-8 md:px-12 py-3 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl 
                    active:transform active:scale-95 cursor-pointer
                "
                    onClick={
                        () => router.push('/create')
                    }
                >
                    Start My Journey
                </button>

            </div>
        </div>
    )
}

export default HomeFirstSection