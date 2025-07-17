'use client'

import { useAuth } from '@/contexts/AuthContext'
import Navbar from '@/components/layout/Navbar'
import { useState } from 'react'

export default function MePage() {
    const { profile, session } = useAuth()
    const [imgLoaded, setImgLoaded] = useState(false)

    // 1) Not signed in yet
    if (!session) {
        return (
            <main className="h-screen flex items-center justify-center">
                <p>Loading authentication…</p>
            </main>
        )
    }

    // 2) Signed in but profile not loaded yet
    if (!profile) {
        return (
            <main className="h-screen flex items-center justify-center">
                <p>Loading profile…</p>
            </main>
        )
    }

    return (
        <main className="flex flex-col w-screen h-screen items-center gap-2 bg-black">
            <div className="w-full bg-gray-600 p-2">
                <Navbar />
            </div>
            <div className="bg-white p-8 rounded-lg shadow-md max-w-sm w-full text-center">
                {/* placeholder while image loads */}
                {
                    !imgLoaded && (
                        <div className="w-24 h-24 rounded-full bg-gray-200 mx-auto animate-pulse" />
                    )
                }
                <img
                    src={profile.avatar_url || '/assets/main/lemona-icon.png'}
                    alt={`${profile.full_name}'s avatar`}
                    className={`
                        w-24 h-24 rounded-full mx-auto transition-opacity duration-300
                        ${imgLoaded ? 'opacity-100' : 'opacity-0'}
                    `}
                    onLoad={() => setImgLoaded(true)}
                />
                <h1 className="mt-2 text-2xl font-semibold">{profile.full_name}</h1>
                <p className="mt-2 text-gray-600">{profile.email}</p>
                <p className="mt-2 text-sm text-gray-500">
                    Joined: {new Date(profile.created_at).toLocaleDateString()}
                </p>
            </div>
        </main>
    )
}
