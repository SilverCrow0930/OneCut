import React, { useEffect, useState, useRef, useCallback } from 'react'
import { apiPath } from '@/lib/config'
import { useAuth } from '@/contexts/AuthContext'
import { Project } from '@/types/projects'
import { formatSecondsAsTimestamp } from '@/lib/utils'
import { useRouter, useSearchParams } from 'next/navigation'
import { Clock, Play, Folder, MoreHorizontal, Trash2, Zap, Video, Eye, Loader2 } from 'lucide-react'

type ProjectFilter = 'all' | 'quickclips'

// Fix the TypeScript errors by defining the proper type for optimistic projects
interface OptimisticProject extends Project {
    is_optimistic?: boolean;
}

export default function ProjectsList() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const { session } = useAuth()
    const [projects, setProjects] = useState<Project[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [showMenu, setShowMenu] = useState<string | null>(null)
    const [activeFilter, setActiveFilter] = useState<ProjectFilter>('all')
    
    // Track polling timeout for cleanup
    const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const isPollingRef = useRef(false)

    // Get highlighted project from URL params
    const highlightedProjectId = searchParams.get('highlight')

    // Get processing project if any
    const processingProject = projects.find(p => 
        p.processing_status === 'processing' || 
        p.processing_status === 'queued'
    )

    // Get processing stage and progress
    const getProcessingStage = (project: Project) => {
        const progress = project.processing_progress || 0
        const message = project.processing_message || ''

        if (project.processing_status === 'queued') {
            return { stage: 'Preparing...', progress: 5 }
        }

        // Map progress to different stages
        if (progress < 20) {
            return { stage: 'Analyzing video...', progress: 15 }
        } else if (progress < 40) {
            return { stage: 'Extracting content...', progress: 35 }
        } else if (progress < 60) {
            return { stage: 'Identifying key moments...', progress: 55 }
        } else if (progress < 80) {
            return { stage: 'Generating smart cuts...', progress: 75 }
        } else if (progress < 95) {
            return { stage: 'Finalizing...', progress: 90 }
        }

        return { stage: message || 'Processing...', progress }
    }

    // Get optimistic projects from localStorage
    const getOptimisticProjects = useCallback((): OptimisticProject[] => {
        try {
            // Use user-specific key to avoid cross-user contamination
            const userId = session?.user?.id;
            if (!userId) return [];
            
            const storageKey = `optimistic_projects_${userId}`;
            const storedProjects = localStorage.getItem(storageKey);
            if (storedProjects) {
                return JSON.parse(storedProjects);
            }
        } catch (err) {
            console.warn('Failed to parse optimistic projects:', err);
        }
        return [];
    }, [session?.user?.id]);

    // Clean up polling on unmount
    useEffect(() => {
        return () => {
            if (pollingTimeoutRef.current) {
                clearTimeout(pollingTimeoutRef.current)
                pollingTimeoutRef.current = null
            }
            isPollingRef.current = false
        }
    }, [])

    useEffect(() => {
        // only fetch once we have a valid token
        if (!session?.access_token) {
            return
        }

        let cancelled = false

        async function load() {
            setLoading(true)
            setError(null)
            
            // Get optimistic projects from localStorage but don't display them yet
            const optimisticProjects = getOptimisticProjects();
            let projectsToTrack = [];
            
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
                    // Merge with any optimistic projects that haven't been replaced yet
                    // A real project will replace an optimistic one with the same ID
                    const optimisticProjectIds = new Set(data.map(p => p.id));
                    const remainingOptimisticProjects = optimisticProjects.filter((p: OptimisticProject) => !optimisticProjectIds.has(p.id));
                    
                    // Combine real and remaining optimistic projects
                    const combinedProjects = [...data, ...remainingOptimisticProjects];
                    projectsToTrack = combinedProjects;
                    
                    // Enhanced sorting logic for Smart Cut projects
                    const sortedProjects = combinedProjects.sort((a, b) => {
                        const aIsSmartCut = a.processing_type === 'quickclips'
                        const bIsSmartCut = b.processing_type === 'quickclips'
                        
                        // 1. For all projects, prioritize by last_opened if available
                            if (a.last_opened && b.last_opened) {
                                return new Date(b.last_opened).getTime() - new Date(a.last_opened).getTime()
                            }
                            
                            // Recently opened projects come first
                            if (a.last_opened && !b.last_opened) return -1
                            if (!a.last_opened && b.last_opened) return 1
                            
                        // 2. For projects without last_opened, Smart Cut projects come first
                            if (aIsSmartCut && !bIsSmartCut) return -1
                            if (!aIsSmartCut && bIsSmartCut) return 1
                        
                        // 3. Finally, sort by created_at (most recent first)
                        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                    })
                    setProjects(sortedProjects)
                    
                    // Start polling only if there's a highlighted project that's processing AND we're not already polling
                    if (highlightedProjectId && !isPollingRef.current) {
                        const highlightedProject = sortedProjects.find(p => p.id === highlightedProjectId)
                        if (highlightedProject?.processing_status === 'processing' || 
                            highlightedProject?.processing_status === 'queued') {
                            startPolling(highlightedProjectId)
                        }
                    }
                    
                    // Also check if any processing projects need polling
                        const processingProject = sortedProjects.find(p => 
                            (p.processing_status === 'processing' || p.processing_status === 'queued') &&
                            p.processing_type === 'quickclips'
                        )
                    
                    if (processingProject && !isPollingRef.current) {
                            startPolling(processingProject.id)
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
    }, [session?.access_token, highlightedProjectId, getOptimisticProjects])

    // Start polling with proper cleanup
    const startPolling = (projectId: string) => {
        if (isPollingRef.current) return // Already polling
        
        isPollingRef.current = true
        pollProjectStatus(projectId)
    }

    // Stop polling
    const stopPolling = () => {
        if (pollingTimeoutRef.current) {
            clearTimeout(pollingTimeoutRef.current)
            pollingTimeoutRef.current = null
        }
        isPollingRef.current = false
    }

    // Poll project status for processing projects - with improved logic
    const pollProjectStatus = async (projectId: string) => {
        // Don't poll if we're not supposed to be polling
        if (!isPollingRef.current) return

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

                // Continue polling if still processing, otherwise stop
                if (updatedProject.processing_status === 'processing' || 
                    updatedProject.processing_status === 'queued') {
                    // Use longer intervals to reduce server load - 5 seconds instead of 3
                    pollingTimeoutRef.current = setTimeout(() => {
                        pollProjectStatus(projectId)
                    }, 5000)
                } else {
                    // Processing finished, stop polling
                    stopPolling()
                }
            } else {
                // Error occurred, stop polling to prevent spam
                console.error('Error polling project status:', response.status)
                stopPolling()
            }
        } catch (error) {
            console.error('Error polling project status:', error)
            // Network error, stop polling to prevent spam
            stopPolling()
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
            
            // Also remove from localStorage to prevent it from reappearing after refresh
            try {
                const userId = session?.user?.id;
                if (userId) {
                    const storageKey = `optimistic_projects_${userId}`;
                    const storedProjects = localStorage.getItem(storageKey);
                    if (storedProjects) {
                        const projects = JSON.parse(storedProjects);
                        const updatedProjects = projects.filter((p: OptimisticProject) => p.id !== project.id);
                        localStorage.setItem(storageKey, JSON.stringify(updatedProjects));
                        console.log('Removed project from localStorage:', project.id);
                    }
                }
            } catch (err) {
                console.warn('Failed to remove project from localStorage:', err);
            }
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
                    const aIsSmartCut = a.processing_type === 'quickclips'
                    const bIsSmartCut = b.processing_type === 'quickclips'
                    
                    // 1. For all projects, prioritize by last_opened if available
                        if (a.last_opened && b.last_opened) {
                            return new Date(b.last_opened).getTime() - new Date(a.last_opened).getTime()
                        }
                        
                        // Recently opened projects come first
                        if (a.last_opened && !b.last_opened) return -1
                        if (!a.last_opened && b.last_opened) return 1
                        
                    // 2. For projects without last_opened, Smart Cut projects come first
                        if (aIsSmartCut && !bIsSmartCut) return -1
                        if (!aIsSmartCut && bIsSmartCut) return 1
                    
                    // 3. Finally, sort by created_at (most recent first)
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
        <div className="w-full">
            {/* Filter Tabs */}
            <div className="flex items-center justify-center mb-8">
                <div className="flex bg-gray-100 rounded-xl p-1">
                    <button
                        onClick={() => setActiveFilter('all')}
                        className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                            activeFilter === 'all'
                                ? 'bg-white text-gray-900 shadow-sm'
                                : 'text-gray-600 hover:text-gray-900'
                        }`}
                    >
                        All projects ({projects.length})
                    </button>
                    <button
                        onClick={() => setActiveFilter('quickclips')}
                        className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 ${
                            activeFilter === 'quickclips'
                                ? 'bg-white text-gray-900 shadow-sm'
                                : 'text-gray-600 hover:text-gray-900'
                        }`}
                    >
                        <Zap className="w-4 h-4" />
                        Smart Cut ({quickclipsProjects.length})
                    </button>
                </div>
            </div>

            {/* Processing status bar */}
            {processingProject && (
                <div className="w-full max-w-6xl mx-auto mb-6">
                    <div className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center gap-3 mb-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span className="text-sm font-medium">
                                {getProcessingStage(processingProject).stage}
                            </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                            <div 
                                className="h-full bg-blue-500 rounded-full transition-all duration-500 ease-out"
                                style={{ 
                                    width: `${getProcessingStage(processingProject).progress}%`,
                                }}
                            />
                        </div>
                    </div>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-8">
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

    // Modern Smart Cut processing card
    if (isQuickClips && isProcessing) {
        return (
            <div className="group cursor-pointer relative" onClick={() => onProjectClick(project.id)}>
                <div className="rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 hover:scale-[1.02] bg-gradient-to-br from-purple-400 via-blue-400 to-emerald-300 flex flex-col justify-between min-h-[220px]">
                    <div className="flex flex-col items-center justify-center h-40 p-4">
                        <div className="w-12 h-12 mb-3 relative flex items-center justify-center">
                            <span className="text-white font-bold text-2xl">{project.processing_progress || 7}%</span>
                        </div>
                        <div className="text-white font-bold text-lg mb-1">Analyzing...</div>
                        <div className="text-white/80 text-sm">{project.processing_message || 'Preparing...'} </div>
                    </div>
                    <div className="bg-white/80 p-4 rounded-b-2xl">
                        <div className="font-semibold text-gray-900 truncate text-base">{project.name || 'Smart Cut'}</div>
                        <div className="text-xs text-gray-500 mt-1">{new Date(project.created_at || Date.now()).toLocaleDateString()}</div>
                        <div className="text-xs text-gray-400 mt-1">Analyzing... • {project.processing_progress || 7}% complete</div>
                    </div>
                </div>

                {/* Three-dot menu button - added to processing card */}
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
            </div>
        )
    }

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
