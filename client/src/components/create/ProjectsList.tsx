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
        if (!session?.access_token) return

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
    }, [session])

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
        return <p className="text-white">
            No projects yet.
        </p>
    }

    return (
        <ul className="grid grid-cols-4 gap-4 p-4">
            {
                projects.map((project, index) => (
                    <div
                        key={index}
                        className="
                            flex flex-col items-center justify-between gap-4
                            border border-white p-3 rounded hover:bg-gray-50/10
                            text-white duration-500
                            cursor-pointer
                        "
                        onClick={
                            () => {
                                router.push(`/projects/${project.id}`)
                            }
                        }
                    >
                        <span className="font-medium text-white">
                            {project.name}
                        </span>
                        <span className="
                            px-2 py-1 rounded-md
                            bg-black/50 text-sm text-white whitespace-nowrap 
                            cursor-pointer
                        ">
                            {
                                project.duration ?
                                    formatSecondsAsTimestamp(project.duration) :
                                    '00:00:00'
                            }
                        </span>
                    </div>
                ))
            }
        </ul>
    )
}
