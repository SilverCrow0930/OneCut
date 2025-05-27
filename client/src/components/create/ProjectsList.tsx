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
        <ul className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {
                projects.map((project, index) => (
                    <div
                        key={index}
                        className="
                            group
                            relative
                            flex flex-col justify-end
                            rounded-xl overflow-hidden
                            bg-transparent hover:bg-gray-800/20
                            text-white transition-colors duration-500
                            cursor-pointer
                            aspect-[9/16] min-h-[220px]
                        "
                        onClick={() => {
                            router.push(`/projects/${project.id}`)
                        }}
                    >
                        {/* Thumbnail */}
                        <img
                            src="/nikokado.jpg"
                            alt="Project thumbnail"
                            className="absolute inset-0 w-full h-full object-cover"
                        />
                        {/* Dark overlay on hover */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-10" />
                        {/* Title and duration container */}
                        <div className="relative z-20 w-full flex flex-col">
                            <span className="w-full px-4 py-3 text-white text-base font-medium text-ellipsis overflow-hidden whitespace-nowrap">
                                {project.name}
                            </span>
                            <span className="
                                absolute bottom-3 right-4
                                px-3 py-1 rounded
                                bg-white/70 backdrop-blur-sm text-xs font-semibold
                                text-gray-900 shadow-md
                            ">
                                {
                                    project.duration ?
                                        formatSecondsAsTimestamp(project.duration) :
                                        '00:00:00'
                                }
                            </span>
                        </div>
                    </div>
                ))
            }
        </ul>
    )
}
