import React, { useEffect, useState } from 'react'
import { apiPath } from '@/lib/config'
import { useAuth } from '@/contexts/AuthContext'
import { Project } from '@/types/projects'
import { formatSecondsAsTimestamp } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { MoreVertical, Trash2, Edit, Play } from 'lucide-react'

export default function ProjectsList() {
    const router = useRouter()
    const { session } = useAuth()
    const [projects, setProjects] = useState<Project[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [showContextMenu, setShowContextMenu] = useState<string | null>(null)
    const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null)
    const [deleting, setDeleting] = useState<string | null>(null)

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

    // Close context menu when clicking outside
    useEffect(() => {
        const handleClickOutside = () => {
            setShowContextMenu(null)
        }
        document.addEventListener('click', handleClickOutside)
        return () => document.removeEventListener('click', handleClickOutside)
    }, [])

    const handleDeleteProject = async (projectId: string) => {
        if (!session?.access_token) return

        setDeleting(projectId)
        try {
            const response = await fetch(apiPath(`projects/${projectId}`), {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                },
            })

            if (!response.ok) {
                const text = await response.text()
                throw new Error(`Delete failed: ${response.status} ${text}`)
            }

            // Remove project from state
            setProjects(prev => prev.filter(p => p.id !== projectId))
            setShowDeleteDialog(null)
        } catch (error: any) {
            console.error('Failed to delete project:', error)
            setError(`Failed to delete project: ${error.message}`)
        } finally {
            setDeleting(null)
        }
    }

    const handleContextMenu = (e: React.MouseEvent, projectId: string) => {
        e.preventDefault()
        e.stopPropagation()
        setShowContextMenu(projectId)
    }

    const handleOpenProject = (projectId: string) => {
        router.push(`/projects/${projectId}`)
    }

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
        <>
            <ul className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {
                    projects.map((project, index) => (
                        <div
                            key={index}
                            className="
                                group
                                relative
                                flex flex-col
                                rounded-lg overflow-hidden
                                bg-gray-900 hover:bg-gray-800
                                text-white transition-all duration-300
                                cursor-pointer
                                aspect-video h-32
                                border border-gray-700 hover:border-gray-600
                                hover:scale-105
                            "
                            onClick={() => handleOpenProject(project.id)}
                        >
                            {/* More options button */}
                            <div className="absolute top-2 left-2 z-30">
                                <button
                                    onClick={(e) => handleContextMenu(e, project.id)}
                                    className="
                                        p-1.5 rounded-full
                                        bg-black/60 hover:bg-black/80
                                        text-white opacity-0 group-hover:opacity-100
                                        transition-opacity duration-200
                                    "
                                >
                                    <MoreVertical size={16} />
                                </button>
                                
                                {/* Context Menu */}
                                {showContextMenu === project.id && (
                                    <div className="absolute top-full left-0 mt-1 bg-gray-800 rounded-lg shadow-lg border border-gray-600 min-w-[140px] z-40">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                setShowContextMenu(null)
                                                handleOpenProject(project.id)
                                            }}
                                            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-white hover:bg-gray-700 rounded-t-lg"
                                        >
                                            <Play size={14} />
                                            Open
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                setShowContextMenu(null)
                                                setShowDeleteDialog(project.id)
                                            }}
                                            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-400 hover:bg-gray-700 rounded-b-lg"
                                        >
                                            <Trash2 size={14} />
                                            Delete
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Thumbnail Background */}
                            <div className="absolute inset-0 w-full h-full">
                                {project.thumbnail_url ? (
                                    <img
                                        src={project.thumbnail_url}
                                        alt={project.name}
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                            // Show fallback background if image fails
                                            const target = e.currentTarget;
                                            target.style.display = 'none';
                                            const fallback = target.parentElement?.querySelector('.fallback-bg');
                                            if (fallback) {
                                                (fallback as HTMLElement).style.display = 'flex';
                                            }
                                        }}
                                    />
                                ) : null}
                                
                                {/* Enhanced fallback background - always present but hidden if image loads */}
                                <div 
                                    className={`fallback-bg w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex flex-col items-center justify-center ${project.thumbnail_url ? 'hidden' : 'flex'}`}
                                >
                                    {/* Video/Film icon */}
                                    <div className="p-3 bg-gray-700/50 rounded-xl mb-2">
                                        <svg 
                                            className="w-6 h-6 text-gray-300" 
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
                                    {/* "No Preview" text */}
                                    <span className="text-xs text-gray-400 font-medium">No Preview</span>
                                </div>
                            </div>

                            {/* Dark overlay on hover */}
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10" />

                            {/* Duration badge - top right */}
                            {project.duration && project.duration > 0 && (
                                <div className="absolute top-2 right-2 z-20">
                                    <span className="
                                        px-2 py-1 rounded
                                        bg-black/70 backdrop-blur-sm text-xs font-medium
                                        text-white shadow-md
                                    ">
                                        {formatSecondsAsTimestamp(project.duration)}
                                    </span>
                                </div>
                            )}

                            {/* Title - bottom */}
                            <div className="absolute bottom-0 left-0 right-0 z-20">
                                <div className="p-3 bg-gradient-to-t from-black/80 to-transparent">
                                    <span className="text-white text-sm font-medium line-clamp-2 leading-tight">
                                        {project.name || `Untitled Project`}
                                    </span>
                                </div>
                            </div>

                            {/* Deleting overlay */}
                            {deleting === project.id && (
                                <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-40">
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white" />
                                        <span className="text-white text-xs">Deleting...</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))
                }
            </ul>

            {/* Delete Confirmation Dialog */}
            {showDeleteDialog && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
                    <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 border border-gray-600">
                        <h3 className="text-lg font-semibold text-white mb-2">Delete Project</h3>
                        <p className="text-gray-300 mb-6">
                            Are you sure you want to delete "{projects.find(p => p.id === showDeleteDialog)?.name}"? 
                            This action cannot be undone.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowDeleteDialog(null)}
                                className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDeleteProject(showDeleteDialog)}
                                disabled={deleting === showDeleteDialog}
                                className="
                                    px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded
                                    disabled:opacity-50 disabled:cursor-not-allowed
                                    transition-colors
                                "
                            >
                                {deleting === showDeleteDialog ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
