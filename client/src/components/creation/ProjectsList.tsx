import React, { useEffect, useState } from 'react'
import { apiPath } from '@/lib/config'
import { useAuth } from '@/contexts/AuthContext'
import { Project } from '@/types/projects'
import { formatSecondsAsTimestamp } from '@/lib/utils'
import { useRouter, useSearchParams } from 'next/navigation'
import { Clock, Play, Folder, MoreHorizontal, Trash2, Zap, Video, Eye } from 'lucide-react'

type ProjectFilter = 'all' | 'quickclips'

export default function ProjectsList() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const { session } = useAuth()
    const [projects, setProjects] = useState<Project[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [showMenu, setShowMenu] = useState<string | null>(null)
    const [activeFilter, setActiveFilter] = useState<ProjectFilter>('all')
    const [processingProject, setProcessingProject] = useState<Project | null>(null)

    // Get highlighted project from URL params
    const highlightedProjectId = searchParams.get('highlight')

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
                    // Sort projects by last_opened (most recent first), fallback to created_at
                    const sortedProjects = data.sort((a, b) => {
                        // First sort by last_opened (most recent first, nulls last)
                        if (a.last_opened && b.last_opened) {
                            return new Date(b.last_opened).getTime() - new Date(a.last_opened).getTime()
                        }
                        if (a.last_opened && !b.last_opened) {
                            return -1 // a (with last_opened) comes first
                        }
                        if (!a.last_opened && b.last_opened) {
                            return 1 // b (with last_opened) comes first
                        }
                        // Both have null last_opened, sort by created_at descending (most recent first)
                        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                    })
                    setProjects(sortedProjects)
                    
                    // If there's a highlighted project that's processing, start polling
                    if (highlightedProjectId) {
                        const highlightedProject = data.find(p => p.id === highlightedProjectId)
                        if (highlightedProject?.processing_status === 'processing' || 
                            highlightedProject?.processing_status === 'queued') {
                            pollProjectStatus(highlightedProjectId)
                        }
                    }
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
    }, [session?.access_token, highlightedProjectId])

    // Poll project status for processing projects
    const pollProjectStatus = async (projectId: string) => {
        try {
            const response = await fetch(apiPath(`projects/${projectId}`), {
                headers: {
                    'Authorization': `Bearer ${session?.access_token}`
                }
            })

            if (response.ok) {
                const updatedProject = await response.json()
                
                // Update the project in the list
                setProjects(prev => prev.map(p => 
                    p.id === projectId ? updatedProject : p
                ))

                // Update processing project state
                if (updatedProject.processing_status === 'processing' || 
                    updatedProject.processing_status === 'queued') {
                    setProcessingProject(updatedProject)
                    setTimeout(() => pollProjectStatus(projectId), 3000)
                } else {
                    setProcessingProject(null)
                }
            }
        } catch (error) {
            console.error('Error polling project status:', error)
            setProcessingProject(null)
        }
    }

    // Filter projects based on active filter
    const filteredProjects = projects.filter(project => {
        if (activeFilter === 'quickclips') {
            return project.processing_type === 'quickclips'
        }
        return true // 'all' shows everything
    })

    // Separate QuickClips projects for special handling
    const quickclipsProjects = projects.filter(project => project.processing_type === 'quickclips')
    const regularProjects = projects.filter(project => project.processing_type !== 'quickclips')

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

    const handleDelete = async (e: React.MouseEvent, project: Project) => {
        console.log('Delete button clicked for project:', project.name, project.id)
        e.preventDefault()
        e.stopPropagation()
        setShowMenu(null)
        
        if (!session?.access_token) {
            console.log('No session token available')
            return
        }

        try {
            console.log('Calling delete API for project:', project.id)
            const response = await fetch(apiPath(`projects/${project.id}`), {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                }
            })
            
            console.log('Delete API response status:', response.status)
            
            if (!response.ok) {
                let errorMessage = 'Failed to delete project'
                try {
                    const errorData = await response.json()
                    errorMessage = errorData?.error || errorMessage
                } catch (e) {
                    errorMessage = response.statusText || errorMessage
                }
                throw new Error(errorMessage)
            }
            
            console.log('Project deleted successfully, removing from local state')
            // Remove from local state
            setProjects(prev => prev.filter(p => p.id !== project.id))
        } catch (error) {
            console.error('Error deleting project:', error)
            alert('Failed to delete project: ' + (error instanceof Error ? error.message : 'Unknown error'))
        }
    }

    const handleProjectClick = (projectId: string) => {
        if (showMenu) {
            setShowMenu(null)
            return
        }
        
        const project = projects.find(p => p.id === projectId)
        
        // Update last_opened optimistically in the UI with a delay to prevent flash
        setTimeout(() => {
            setProjects(prev => {
                const updatedProjects = prev.map(p => 
                    p.id === projectId 
                        ? { ...p, last_opened: new Date().toISOString() }
                        : p
                )
                // Re-sort after updating last_opened
                return updatedProjects.sort((a, b) => {
                    if (a.last_opened && b.last_opened) {
                        return new Date(b.last_opened).getTime() - new Date(a.last_opened).getTime()
                    }
                    if (a.last_opened && !b.last_opened) {
                        return -1
                    }
                    if (!a.last_opened && b.last_opened) {
                        return 1
                    }
                    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                })
            })
        }, 5000) // Delay re-sorting by 5000ms to let navigation start first
        
        // Special handling for QuickClips projects
        if (project?.processing_type === 'quickclips') {
            if (project.processing_status === 'completed' && project.processing_result?.clips) {
                // Show clips modal or navigate to clips view
                router.push(`/projects/quickclips/${projectId}`)
                return
            }
        }
        
        router.push(`/projects/${projectId}`)
    }

    const handleViewClips = (e: React.MouseEvent, projectId: string) => {
        e.preventDefault()
        e.stopPropagation()
        console.log('View Clips clicked for project:', projectId)
        
        // Close the menu
        setShowMenu(null)
        
        // Navigate to QuickClips view
        router.push(`/projects/quickclips/${projectId}`)
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
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Filter Tabs */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex gap-2">
                    <button
                        onClick={() => setActiveFilter('all')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            activeFilter === 'all'
                                ? 'bg-gray-900 text-white'
                                : 'text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                        All Projects
                    </button>
                    <button
                        onClick={() => setActiveFilter('quickclips')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            activeFilter === 'quickclips'
                                ? 'bg-gray-900 text-white'
                                : 'text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                        Smart Cut
                    </button>
                </div>
            </div>

            {/* Processing Progress Bar */}
            {processingProject && (
                <div className="mb-6 bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                        <span className="text-sm font-medium text-gray-700">
                            Processing {processingProject.name}
                        </span>
                        <span className="text-sm text-gray-500">
                            {processingProject.processing_progress}%
                        </span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-blue-500 transition-all duration-300 ease-out"
                            style={{ width: `${processingProject.processing_progress}%` }}
                        />
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                        {processingProject.processing_message || 'Processing your video...'}
                    </p>
                </div>
            )}

            {/* Projects Grid */}
            {filteredProjects.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-20 h-20 mb-6 text-gray-300">
                        {activeFilter === 'quickclips' ? (
                            <Zap className="w-full h-full" strokeWidth={1} />
                        ) : (
                            <Folder className="w-full h-full" strokeWidth={1} />
                        )}
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                        {activeFilter === 'quickclips' ? 'No Smart Cut projects yet' : 'No projects found'}
                    </h3>
                    <p className="text-gray-500 max-w-sm">
                        {activeFilter === 'quickclips' 
                            ? 'Create your first AI-powered video clips using Smart Cut.' 
                            : 'Start creating amazing videos by making your first project.'}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredProjects.map((project, index) => (
                        <ProjectCard 
                            key={project.id}
                            project={project}
                            isHighlighted={project.id === highlightedProjectId}
                            onProjectClick={handleProjectClick}
                            onMenuClick={handleMenuClick}
                            onDelete={handleDelete}
                            onViewClips={handleViewClips}
                            showMenu={showMenu}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

// Separate ProjectCard component for better organization
interface ProjectCardProps {
    project: Project
    isHighlighted: boolean
    onProjectClick: (projectId: string) => void
    onMenuClick: (e: React.MouseEvent, projectId: string) => void
    onDelete: (e: React.MouseEvent, project: Project) => void
    onViewClips: (e: React.MouseEvent, projectId: string) => void
    showMenu: string | null
}

function ProjectCard({ 
    project, 
    isHighlighted, 
    onProjectClick, 
    onMenuClick, 
    onDelete, 
    onViewClips, 
    showMenu 
}: ProjectCardProps) {
    const isQuickClips = project.processing_type === 'quickclips'
    const isProcessing = project.processing_status === 'processing' || project.processing_status === 'queued'
    const isCompleted = project.processing_status === 'completed'
    const hasFailed = project.processing_status === 'failed'
    const clipCount = project.processing_result?.clips?.length || 0

    return (
        <div
            className={`group cursor-pointer relative ${isHighlighted ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
            onClick={() => onProjectClick(project.id)}
        >
            <div className={`bg-white rounded-2xl border-0 overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 hover:scale-[1.02] ${
                isQuickClips ? 'border-l-4 border-l-emerald-500' : ''
            }`}>
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
                        className={`fallback-content w-full h-full ${
                            isQuickClips 
                                ? 'bg-gradient-to-br from-emerald-50 to-teal-100' 
                                : 'bg-gradient-to-br from-gray-50 to-gray-100'
                        } flex flex-col items-center justify-center ${project.thumbnail_url ? 'hidden' : 'flex'}`}
                    >
                        <div className={`w-14 h-14 mb-3 ${isQuickClips ? 'text-emerald-400' : 'text-gray-300'}`}>
                            {isQuickClips ? (
                                <Zap className="w-full h-full" strokeWidth={1.5} />
                            ) : (
                                <Play className="w-full h-full" strokeWidth={1.5} />
                            )}
                        </div>
                        <span className={`text-sm font-medium ${isQuickClips ? 'text-emerald-600' : 'text-gray-400'}`}>
                                                                    {isQuickClips ? 'Smart Cut' : 'No Preview'}
                        </span>
                    </div>

                    {/* QuickClips status badge */}
                    {isQuickClips && (
                        <div className="absolute top-3 left-3">
                            <div className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${
                                isProcessing 
                                    ? 'bg-blue-100 text-blue-700' 
                                    : isCompleted 
                                        ? 'bg-emerald-100 text-emerald-700' 
                                        : hasFailed 
                                            ? 'bg-red-100 text-red-700'
                                            : 'bg-gray-100 text-gray-700'
                            }`}>
                                {isProcessing ? (
                                    <>
                                        <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
                                        Processing
                                    </>
                                ) : isCompleted ? (
                                    <>
                                        {clipCount} clips
                                    </>
                                ) : hasFailed ? (
                                    'Failed'
                                ) : (
                                                                                'Smart Cut'
                                )}
                            </div>
                        </div>
                    )}

                    {/* Three-dot menu button - only visible on hover */}
                    <div 
                        className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10"
                        onMouseDown={(e) => {
                            e.stopPropagation()
                        }}
                        onClick={(e) => {
                            e.stopPropagation()
                        }}
                    >
                        <button
                            onMouseDown={(e) => {
                                e.stopPropagation()
                            }}
                            onClick={(e) => {
                                console.log('Menu button clicked')
                                onMenuClick(e, project.id)
                            }}
                            className="w-9 h-9 bg-white/95 hover:bg-white rounded-full shadow-lg flex items-center justify-center transition-all duration-200 backdrop-blur-sm"
                        >
                            <MoreHorizontal className="w-4 h-4 text-gray-600" />
                        </button>
                        
                        {/* Dropdown menu */}
                        {showMenu === project.id && (
                            <div className="absolute right-0 mt-2 w-44 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50">
                                {isQuickClips && isCompleted && (
                                    <button
                                        onClick={(e) => {
                                            console.log('View Clips button clicked')
                                            onViewClips(e, project.id)
                                        }}
                                        className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-200 flex items-center gap-3"
                                    >
                                        <Eye className="w-4 h-4" />
                                        View Clips
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onMouseDown={(e) => {
                                        console.log('DIRECT DELETE MOUSEDOWN - calling onDelete directly')
                                        e.preventDefault()
                                        e.stopPropagation()
                                        // Call delete directly on mousedown to bypass any click issues
                                        onDelete(e, project)
                                    }}
                                    className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors duration-200 flex items-center gap-3"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Delete
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <div className="bg-white/95 backdrop-blur-sm rounded-full p-4 shadow-lg">
                            {isQuickClips && isCompleted ? (
                                <Eye className="w-6 h-6 text-gray-600" />
                            ) : (
                                <Play className="w-6 h-6 text-gray-600" />
                            )}
                        </div>
                    </div>
                </div>

                {/* Project info */}
                <div className="p-6">
                    <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-gray-900 truncate text-base flex-1">
                            {project.name || 'Untitled Project'}
                        </h3>
                    </div>
                    <p className="text-sm text-gray-500">
                        {new Date(project.created_at || Date.now()).toLocaleDateString()}
                    </p>
                    {isQuickClips && project.processing_message && (
                        <p className="text-xs text-gray-400 mt-1 truncate">
                            {project.processing_message}
                        </p>
                    )}
                </div>
            </div>
        </div>
    )
}
