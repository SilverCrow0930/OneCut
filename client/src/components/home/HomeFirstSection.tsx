import React from 'react'
import { useRouter } from 'next/navigation'

const HomeFirstSection = () => {
    const router = useRouter()
    return (
        <div className="
            flex flex-col w-full h-screen items-center justify-center
        ">
            <div className="flex flex-col items-center justify-center gap-4">

                {/* Title */}
                <h1 className="text-7xl text-white font-bold">
                    The AI Video Studio
                </h1>

                {/* Description */}
                <div className="flex flex-col items-center justify-center gap-1">
                    <p className="text-xl text-gray-200">
                        Transform ideas into short videos that captivate.
                    </p>
                    <p className="text-xl text-gray-200">
                        Your next viral hit starts here.
                    </p>
                </div>

                {/* Button */}
                <button
                    className="
                        bg-red-400 hover:bg-red-500 border-2 border-white
                        text-white font-semibold text-xl
                        px-8 py-4 rounded-full transition-all duration-300 shadow-lg hover:shadow-xl 
                        active:transform active:scale-95 cursor-pointer
                    "
                    onClick={
                        () => router.push('/create')
                    }
                >
                    CREATE MY VIDEO WITH AI
                </button>

            </div>
        </div>
    )
}

export default HomeFirstSection