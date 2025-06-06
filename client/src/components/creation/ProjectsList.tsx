import React, { useEffect, useState } from 'react'
import { apiPath } from '@/lib/config'
import { useAuth } from '@/contexts/AuthContext'
import { Project } from '@/types/projects'
import { formatSecondsAsTimestamp } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { Clock, Play, Folder, MoreHorizontal, Download, Copy, Trash2, Loader2, CheckCircle, AlertCircle, Zap } from 'lucide-react'

export default function ProjectsList() {
    const router = useRouter()
    const { session } = useAuth()
    const [projects, setProjects] = useState<Project[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [showMenu, setShowMenu] = useState<string | null>(null)

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

        // Set up polling for processing projects
        const interval = setInterval(() => {
            const hasProcessingProjects = projects.some(p => 
                p.project_type === 'quickclips' && p.processing_status === 'processing'
            )
            if (hasProcessingProjects) {
                load()
            }
        }, 5000) // Poll every 5 seconds

        // cleanup in case the component unmounts early
        return () => {
            cancelled = true
            clearInterval(interval)
        }
    }, [session?.access_token, projects])

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            setShowMenu(null)
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleMenuClick = (e: React.MouseEvent, projectId: string) => {
        e.preventDefault()
        e.stopPropagation()
        setShowMenu(showMenu === projectId ? null : projectId)
    }

    const handleDownload = async (e: React.MouseEvent, project: Project) => {
        e.preventDefault()
        e.stopPropagation()
        setShowMenu(null)
        // TODO: Implement download functionality
        console.log('Download project:', project.id)
        alert('Download functionality coming soon!')
    }

    const handleDuplicate = async (e: React.MouseEvent, project: Project) => {
        e.preventDefault()
        e.stopPropagation()
        setShowMenu(null)
        
        if (!session?.access_token) return

        try {
            const response = await fetch(apiPath(`projects/${project.id}/duplicate`), {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json'
                }
            })
            
            if (!response.ok) {
                throw new Error('Failed to duplicate project')
            }
            
            // Refresh the projects list
            window.location.reload()
        } catch (error) {
            console.error('Error duplicating project:', error)
            alert('Failed to duplicate project')
        }
    }

    const handleDelete = async (e: React.MouseEvent, project: Project) => {
        e.preventDefault()
        e.stopPropagation()
        setShowMenu(null)
        
        if (!confirm(`Are you sure you want to delete "${project.name || 'Untitled Project'}"? This action cannot be undone.`)) {
            return
        }

        if (!session?.access_token) return

        try {
            const response = await fetch(apiPath(`projects/${project.id}`), {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                }
            })
            
            if (!response.ok) {
                throw new Error('Failed to delete project')
            }
            
            // Remove from local state
            setProjects(prev => prev.filter(p => p.id !== project.id))
        } catch (error) {
            console.error('Error deleting project:', error)
            alert('Failed to delete project')
        }
    }

    const getProjectStatusDisplay = (project: Project) => {
        if (project.project_type !== 'quickclips') {
            return null
        }

        switch (project.processing_status) {
            case 'processing':
                return (
                    <div className="absolute inset-0 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center">
                        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mb-3" />
                        <p className="text-sm font-medium text-gray-900 mb-1">AI Processing...</p>
                        <p className="text-xs text-gray-600 text-center px-4">{project.processing_message}</p>
                        {project.processing_progress !== undefined && (
                            <div className="w-20 bg-gray-200 rounded-full h-1.5 mt-3">
                                <div 
                                    className="bg-emerald-600 h-1.5 rounded-full transition-all duration-500"
                                    style={{ width: `${project.processing_progress}%` }}
                                ></div>
                            </div>
                        )}
                    </div>
                )
            case 'error':
                return (
                    <div className="absolute inset-0 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center">
                        <AlertCircle className="w-8 h-8 text-red-600 mb-3" />
                        <p className="text-sm font-medium text-red-900 mb-1">Processing Failed</p>
                        <p className="text-xs text-red-600 text-center px-4">{project.error_message || 'Unknown error'}</p>
                    </div>
                )
            case 'completed':
                return (
                    <div className="absolute top-2 left-2">
                        <div className="flex items-center gap-1 bg-emerald-500 text-white px-2 py-1 rounded-full text-xs font-medium">
                            <CheckCircle className="w-3 h-3" />
                            Ready
                        </div>
                    </div>
                )
            default:
                return null
        }
    }

    const getProjectTypeIcon = (project: Project) => {
        if (project.project_type === 'quickclips') {
            return <Zap className="w-4 h-4 text-emerald-600" />
        }
        return <Play className="w-4 h-4 text-gray-400" />
    }

    const handleProjectClick = (project: Project) => {
        if (showMenu) {
            setShowMenu(null)
            return
        }
        
        if (project.project_type === 'quickclips') {
            // For QuickClips projects, go to a special view
            router.push(`/quickclips/${project.id}`)
        } else {
            // For regular projects, go to the editor
            router.push(`/projects/${project.id}`)
        }
    }

    if (!session) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 mb-4 text-gray-400">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                    </svg>
                </div>
                <p className="text-gray-600">Please sign in to see your projects.</p>
            </div>
        )
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="flex items-center space-x-3 text-gray-600">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    <span>Loading your projects...</span>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 mb-4 text-red-400">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                </div>
                <p className="text-red-600 font-medium">Error loading projects</p>
                <p className="text-gray-600 text-sm mt-1">{error}</p>
            </div>
        )
    }

    if (projects.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-20 h-20 mb-6 text-gray-300">
                    <Folder className="w-full h-full" strokeWidth={1} />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No projects yet</h3>
                <p className="text-gray-500 max-w-sm">
                    Start creating amazing videos by making your first project. Click "Create New Project" to get started.
                </p>
            </div>
        )
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-8">
            {projects.map((project, index) => (
                <div
                    key={project.id}
                    className="group cursor-pointer relative"
                    onClick={() => handleProjectClick(project)}
                >
                    <div className="bg-white rounded-2xl border-0 overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
                        {/* Thumbnail */}
                        <div className="aspect-video relative bg-gray-50">
                            {project.thumbnail_url ? (
                                <img
                                    src={project.thumbnail_url}
                                    alt={project.name}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        const target = e.currentTarget;
                                        target.style.display = 'none';
                                        const fallback = target.parentElement?.querySelector('.fallback-content');
                                        if (fallback) {
                                            (fallback as HTMLElement).style.display = 'flex';
                                        }
                                    }}
                                />
                            ) : null}
                            
                            {/* Fallback content */}
                            <div 
                                className={`fallback-content w-full h-full bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col items-center justify-center ${project.thumbnail_url ? 'hidden' : 'flex'}`}
                            >
                                <div className="w-14 h-14 text-gray-300 mb-3">
                                    {getProjectTypeIcon(project)}
                                </div>
                                <span className="text-sm text-gray-400 font-medium">
                                    {project.project_type === 'quickclips' ? 'QuickClips' : 'No Preview'}
                                </span>
                            </div>

                            {/* Processing/Status Overlay */}
                            {getProjectStatusDisplay(project)}

                            {/* Three-dot menu button - only visible on hover and when not processing */}
                            {project.processing_status !== 'processing' && (
                                <div 
                                    className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10"
                                    onMouseDown={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                    }}
                                    onClick={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                    }}
                                >
                                    <button
                                        onMouseDown={(e) => {
                                            e.preventDefault()
                                            e.stopPropagation()
                                        }}
                                        onClick={(e) => handleMenuClick(e, project.id)}
                                        className="w-9 h-9 bg-white/95 hover:bg-white rounded-full shadow-lg flex items-center justify-center transition-all duration-200 backdrop-blur-sm"
                                    >
                                        <MoreHorizontal className="w-4 h-4 text-gray-600" />
                                    </button>
                                    
                                    {/* Dropdown menu */}
                                    {showMenu === project.id && (
                                        <div 
                                            className="absolute right-0 mt-2 w-44 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50"
                                            onMouseDown={(e) => {
                                                e.preventDefault()
                                                e.stopPropagation()
                                            }}
                                            onClick={(e) => {
                                                e.preventDefault()
                                                e.stopPropagation()
                                            }}
                                        >
                                            <button
                                                onClick={(e) => handleDownload(e, project)}
                                                className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-200 flex items-center gap-3"
                                            >
                                                <Download className="w-4 h-4" />
                                                Download
                                            </button>
                                            <button
                                                onClick={(e) => handleDuplicate(e, project)}
                                                className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-200 flex items-center gap-3"
                                            >
                                                <Copy className="w-4 h-4" />
                                                Duplicate
                                            </button>
                                            <button
                                                onClick={(e) => handleDelete(e, project)}
                                                className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors duration-200 flex items-center gap-3"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                                Delete
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Hover overlay - only show when not processing */}
                            {project.processing_status !== 'processing' && (
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
                                    <div className="bg-white/95 backdrop-blur-sm rounded-full p-4 shadow-lg">
                                        {getProjectTypeIcon(project)}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Project info */}
                        <div className="p-6">
                            <div className="flex items-center gap-2 mb-2">
                                {project.project_type === 'quickclips' && (
                                    <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 px-2 py-1 rounded-full text-xs font-medium">
                                        <Zap className="w-3 h-3" />
                                        QuickClips
                                    </span>
                                )}
                                <h3 className="font-semibold text-gray-900 truncate text-base flex-1">
                                    {project.name || 'Untitled Project'}
                                </h3>
                            </div>
                            <div className="flex items-center justify-between">
                                <p className="text-sm text-gray-500">
                                    {new Date(project.created_at || Date.now()).toLocaleDateString()}
                                </p>
                                {project.project_type === 'quickclips' && project.quickclips_data?.clips && (
                                    <p className="text-xs text-gray-400">
                                        {project.quickclips_data.clips.length} clips ready
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    )
}
