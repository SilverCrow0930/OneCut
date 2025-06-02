import React, { useEffect, useState } from 'react'
import { apiPath } from '@/lib/config'
import { useAuth } from '@/contexts/AuthContext'
import { Project } from '@/types/projects'
import { formatSecondsAsTimestamp } from '@/lib/utils'
import { useRouter } from 'next/navigation'

export default function ProjectsList() {
    const router = useRouter()
    const { session } = useAuth()
    const [projects, setProjects] = useState<Project[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        // only fetch once we have a valid token
        if (!session?.access_token) {
            return
        }

        let cancelled = false

        async function load() {
            setLoading(true)
            setError(null)
            try {
                const res = await fetch(apiPath('projects'), {
                    headers: {
                        Authorization: `Bearer ${session?.access_token}`,
                    },
                })
                if (!res.ok) {
                    const text = await res.text()
                    throw new Error(`Error ${res.status}: ${text}`)
                }
                const data: Project[] = await res.json()
                if (!cancelled) {
                    setProjects(data)
                }
            }
            catch (error: any) {
                if (!cancelled) {
                    setError(error.message)
                }
            }
            finally {
                if (!cancelled) {
                    setLoading(false)
                }
            }
        }

        load()

        // cleanup in case the component unmounts early
        return () => {
            cancelled = true
        }
    }, [session?.access_token])

    if (!session) {
        return <p className="text-white">
            Please sign in to see your projects.
        </p>
    }
    if (loading) {
        return <p className="text-white">
            Loading projects ...
        </p>
    }
    if (error) {
        return <p className="text-red-500">
            Error: {error}
        </p>
    }
    if (projects.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] py-12 px-4 text-center">
                <div className="w-24 h-24 mb-6 text-gray-400">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                    </svg>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">No Projects Yet</h3>
                <p className="text-gray-400 max-w-sm">
                    Get started by creating your first project.
                </p>
            </div>
        )
    }

    return (
        <ul className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {
                projects.map((project, index) => (
                    <div
                        key={index}
                        className="
                            group
                            relative
                            flex flex-col justify-end
                            rounded-lg overflow-hidden
                            bg-gray-900 hover:bg-gray-800
                            text-white transition-all duration-300
                            cursor-pointer
                            aspect-video h-32
                            border border-gray-700 hover:border-gray-600
                            hover:scale-105
                        "
                        onClick={() => {
                            router.push(`/projects/${project.id}`)
                        }}
                    >
                        {/* Thumbnail */}
                        <div className="absolute inset-0 w-full h-full">
                            {project.thumbnail_url ? (
                                <img
                                    src={project.thumbnail_url}
                                    alt={project.name}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        // Fallback to gradient background if image fails
                                        e.currentTarget.style.display = 'none';
                                    }}
                                />
                            ) : (
                                // Default gradient background when no thumbnail
                                <div className="w-full h-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                                    <svg 
                                        className="w-8 h-8 text-gray-400" 
                                        fill="none" 
                                        stroke="currentColor" 
                                        viewBox="0 0 24 24"
                                    >
                                        <path 
                                            strokeLinecap="round" 
                                            strokeLinejoin="round" 
                                            strokeWidth={1.5} 
                                            d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" 
                                        />
                                    </svg>
                                </div>
                            )}
                        </div>

                        {/* Dark overlay on hover */}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10" />

                        {/* Title and duration container */}
                        <div className="relative z-20 w-full flex flex-col">
                            <span className="w-full px-3 py-2 text-white text-sm font-medium text-ellipsis overflow-hidden whitespace-nowrap">
                                {project.name}
                            </span>
                            {project.duration && (
                                <span className="
                                    absolute top-2 right-2
                                    px-2 py-1 rounded
                                    bg-black/70 backdrop-blur-sm text-xs font-medium
                                    text-white shadow-md
                                ">
                                    {formatSecondsAsTimestamp(project.duration)}
                                </span>
                            )}
                        </div>
                    </div>
                ))
            }
        </ul>
    )
}
