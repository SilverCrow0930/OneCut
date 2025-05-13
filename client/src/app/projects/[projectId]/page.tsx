'use client'

import Editor from "@/components/editor/Editor"
import { useAuth } from "@/contexts/AuthContext"
import { apiPath } from "@/lib/config"
import { Project } from "@/types/projects"
import { useParams } from 'next/navigation'
import { useEffect, useState } from "react"

export default function EditPage() {
    const { projectId } = useParams()
    const { session } = useAuth()
    const [project, setProject] = useState<Project | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!session?.access_token) return

        let cancelled = false
        setLoading(true)
        setError(null)

            ; (async () => {
                try {
                    const response = await fetch(
                        apiPath(`projects/${projectId}`),
                        {
                            headers: {
                                Authorization: `Bearer ${session.access_token}`,
                            },
                        }
                    )

                    if (!response.ok) {
                        const errorText = await response.text()
                        throw new Error(errorText || response.statusText)
                    }

                    const data: Project = await response.json()

                    if (!cancelled) {
                        setProject(data)
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
            })()

        return () => {
            cancelled = true
        }
    }, [session, projectId])


    return (
        <Editor />
    )
}