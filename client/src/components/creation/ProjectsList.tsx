import React, { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { apiPath } from '@/lib/config'
import { MoreVertical, Folder, Trash2, Play, Zap, Calendar, Eye } from 'lucide-react'
import { Project } from '@/types/projects'

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
    
    // Track polling timeout for cleanup
    const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const isPollingRef = useRef(false)
    const pollingProjectIdRef = useRef<string | null>(null)

    // Get highlighted project from URL params
    const highlightedProjectId = searchParams.get('highlight')

    // Get processing project if any
    const processingProjects = projects.filter(p => 
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
            return { stage: 'Analyzing video...', progress: Math.max(5, progress) }
        } else if (progress < 40) {
            return { stage: 'Extracting content...', progress: progress }
        } else if (progress < 60) {
            return { stage: 'Identifying key moments...', progress: progress }
        } else if (progress < 80) {
            return { stage: 'Generating smart cuts...', progress: progress }
        } else if (progress < 95) {
            return { stage: 'Finalizing...', progress: progress }
        }

        return { stage: message || 'Processing...', progress }
    }

    useEffect(() => {
        let cancelled = false
        
        async function load() {
            try {
                if (!session?.access_token) {
                    return
                }
                
                const response = await fetch(apiPath('projects'), {
                    headers: {
                        'Authorization': `Bearer ${session.access_token}`
                    }
                })
                
                if (!response.ok) {
                    throw new Error(`Failed to fetch projects: ${response.statusText}`)
                }
                
                const data = await response.json()
                
                if (!cancelled) {
                    // Enhanced sorting logic for Smart Cut projects
                    const sortedProjects = data.sort((a: Project, b: Project) => {
                        const aIsSmartCut = a.processing_type === 'quickclips'
                        const bIsSmartCut = b.processing_type === 'quickclips'
                        const aIsProcessing = (a.processing_status === 'processing' || a.processing_status === 'queued') && aIsSmartCut
                        const bIsProcessing = (b.processing_status === 'processing' || b.processing_status === 'queued') && bIsSmartCut
                        
                        // 1. Processing Smart Cut projects come first (highest priority)
                        if (aIsProcessing && !bIsProcessing) return -1
                        if (!aIsProcessing && bIsProcessing) return 1
                        
                        // 2. For non-processing projects, prioritize by last_opened if available
                        if (!aIsProcessing && !bIsProcessing) {
                            // If both have last_opened, sort by most recent
                            if (a.last_opened && b.last_opened) {
                                return new Date(b.last_opened).getTime() - new Date(a.last_opened).getTime()
                            }
                            
                            // Recently opened projects come first
                            if (a.last_opened && !b.last_opened) return -1
                            if (!a.last_opened && b.last_opened) return 1
                            
                            // 3. For projects without last_opened, Smart Cut projects come first
                            if (aIsSmartCut && !bIsSmartCut) return -1
                            if (!aIsSmartCut && bIsSmartCut) return 1
                            
                            // 4. Finally, sort by created_at (most recent first)
                            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                        }
                        
                        // Both are processing, sort by created_at (most recent first)
                        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                    })
                    setProjects(sortedProjects)
                    
                    // First priority: poll highlighted project if it's processing
                    if (highlightedProjectId) {
                        const highlightedProject = data.find((p: Project) => p.id === highlightedProjectId)
                        if (highlightedProject?.processing_status === 'processing' || highlightedProject?.processing_status === 'queued') {
                            // Start polling the highlighted project if not already polling or polling a different project
                            if (!isPollingRef.current || pollingProjectIdRef.current !== highlightedProjectId) {
                                stopPolling(); // Stop any existing polling
                                startPolling(highlightedProjectId);
                                console.log(`[Projects] Starting polling for highlighted project: ${highlightedProjectId}`);
                                return;
                            }
                        }
                    }
                    
                    // Second priority: if any project is processing and we're not polling, start polling
                    const firstProcessingProject = sortedProjects.find((p: Project) => 
                        p.processing_status === 'processing' || p.processing_status === 'queued'
                    );
                    
                    if (firstProcessingProject && !isPollingRef.current) {
                        console.log(`[Projects] Starting polling for processing project: ${firstProcessingProject.id}`);
                        startPolling(firstProcessingProject.id);
                    }
                    
                    // If we were polling a project that's no longer processing, stop polling
                    if (isPollingRef.current && pollingProjectIdRef.current) {
                        const pollingProject = sortedProjects.find((p: Project) => p.id === pollingProjectIdRef.current);
                        if (!pollingProject || (pollingProject.processing_status !== 'processing' && pollingProject.processing_status !== 'queued')) {
                            console.log(`[Projects] Stopping polling - project no longer processing: ${pollingProjectIdRef.current}`);
                            stopPolling();
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

    // Start polling with proper cleanup
    const startPolling = (projectId: string) => {
        if (isPollingRef.current && pollingProjectIdRef.current === projectId) return // Already polling this project
        
        isPollingRef.current = true
        pollingProjectIdRef.current = projectId;
        
        // Add the dummy processing animation for immediate feedback
        setProjects(prev => prev.map((p: Project) => {
            if (p.id === projectId && (p.processing_status === 'processing' || p.processing_status === 'queued')) {
                // Animate progress to give user visual feedback even before server updates
                const currentProgress = p.processing_progress || 0;
                const nextProgress = Math.min(95, currentProgress + 5); // Cap at 95% since 100% should come from server
                
                return {
                    ...p,
                    processing_progress: nextProgress
                };
            }
            return p;
        }));
        
        pollProjectStatus(projectId)
    }

    // Stop polling
    const stopPolling = () => {
        if (pollingTimeoutRef.current) {
            clearTimeout(pollingTimeoutRef.current)
            pollingTimeoutRef.current = null
        }
        isPollingRef.current = false
        pollingProjectIdRef.current = null;
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
                setProjects(prev => prev.map((p: Project) => 
                    p.id === projectId ? updatedProject : p
                ))

                // Continue polling if still processing, otherwise stop
                if (updatedProject.processing_status === 'processing' || 
                    updatedProject.processing_status === 'queued') {
                    
                    // Keep polling but incrementally increase progress for visual feedback
                    setProjects(prev => prev.map((p: Project) => {
                        if (p.id === projectId && (p.processing_status === 'processing' || p.processing_status === 'queued')) {
                            const currentProgress = p.processing_progress || 0;
                            if (currentProgress < 95) {
                                // Advance progress by 1-3% each poll to show movement
                                const increment = Math.random() * 2 + 1; // 1-3%
                                const nextProgress = Math.min(95, currentProgress + increment);
                                
                                return {
                                    ...p,
                                    processing_progress: nextProgress
                                };
                            }
                        }
                        return p;
                    }));
                    
                    // Use adaptive intervals to reduce server load
                    const interval = 5000; // 5 second interval
                    
                    pollingTimeoutRef.current = setTimeout(() => {
                        pollProjectStatus(projectId)
                    }, interval)
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
                    const aIsProcessing = (a.processing_status === 'processing' || a.processing_status === 'queued') && aIsSmartCut
                    const bIsProcessing = (b.processing_status === 'processing' || b.processing_status === 'queued') && bIsSmartCut
                    
                    // 1. Processing Smart Cut projects come first (highest priority)
                    if (aIsProcessing && !bIsProcessing) return -1
                    if (!aIsProcessing && bIsProcessing) return 1
                    
                    // 2. For non-processing projects, prioritize by last_opened if available
                    if (!aIsProcessing && !bIsProcessing) {
                        // If both have last_opened, sort by most recent
                        if (a.last_opened && b.last_opened) {
                            return new Date(b.last_opened).getTime() - new Date(a.last_opened).getTime()
                        }
                        
                        // Recently opened projects come first
                        if (a.last_opened && !b.last_opened) return -1
                        if (!a.last_opened && b.last_opened) return 1
                        
                        // 3. For projects without last_opened, Smart Cut projects come first
                        if (aIsSmartCut && !bIsSmartCut) return -1
                        if (!aIsSmartCut && bIsSmartCut) return 1
                        
                        // 4. Finally, sort by created_at (most recent first)
                        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                    }
                    
                    // Both are processing, sort by created_at (most recent first)
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
            {processingProjects.length > 0 && (
                <div className="w-full max-w-6xl mx-auto mb-6">
                    <div className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center gap-3 mb-2">
                            <svg className="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span className="text-sm font-medium">
                                {getProcessingStage(processingProjects[0]).stage}
                            </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                            <div 
                                className="h-full bg-blue-500 rounded-full transition-all duration-500 ease-out"
                                style={{ 
                                    width: `${getProcessingStage(processingProjects[0]).progress}%`,
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
    
    // Get processing stage for this card
    const getCardProcessingStage = () => {
        const progress = project.processing_progress || 0
        
        if (project.processing_status === 'queued') {
            return { stage: 'Preparing...', progress: 5 }
        }

        // Map progress to different stages
        if (progress < 20) {
            return { stage: 'Analyzing...', progress }
        } else if (progress < 40) {
            return { stage: 'Extracting...', progress }
        } else if (progress < 60) {
            return { stage: 'Processing...', progress }
        } else if (progress < 80) {
            return { stage: 'Generating...', progress }
        } else if (progress < 95) {
            return { stage: 'Finalizing...', progress }
        }

        return { stage: 'Processing...', progress }
    }
    
    const processingStage = getCardProcessingStage()

    return (
        <div
            className={`group cursor-pointer relative ${isHighlighted ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
            onClick={() => onProjectClick(project.id)}
        >
            <div className={`bg-white rounded-2xl border-0 overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 hover:scale-[1.02] ${
                isQuickClips ? 'border-l-4 border-l-emerald-500' : ''
            }`}>
                {/* Thumbnail */}
                <div className="relative aspect-video bg-gray-100 overflow-hidden">
                    {/* Processing overlay */}
                    {isProcessing && (
                        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/80 to-indigo-500/80 flex flex-col items-center justify-center text-white z-10">
                            {/* Animated pulse effect */}
                            <div className="absolute inset-0 bg-white opacity-10 animate-pulse"></div>
                            
                            <div className="text-center z-20 px-4">
                                <div className="mb-3 flex flex-col items-center">
                                    <svg className="animate-spin h-6 w-6 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <span className="font-semibold">{processingStage.stage}</span>
                                </div>
                                
                                <div className="w-full h-1.5 bg-white/30 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-white rounded-full transition-all duration-500 ease-out"
                                        style={{ width: `${processingStage.progress}%` }}
                                    ></div>
                                </div>
                                
                                <div className="mt-2 text-xs font-medium">
                                    {Math.round(processingStage.progress)}% complete
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Failed overlay */}
                    {hasFailed && (
                        <div className="absolute inset-0 bg-red-500/80 flex items-center justify-center text-white z-10">
                            <div className="text-center">
                                <div className="mb-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <span className="font-medium text-sm">Processing failed</span>
                            </div>
                        </div>
                    )}

                    {/* Completed QuickClips badge */}
                    {isQuickClips && isCompleted && (
                        <div className="absolute top-2 right-2 bg-emerald-500 text-white text-xs px-2 py-1 rounded-full z-10">
                            {clipCount} clip{clipCount !== 1 && 's'}
                        </div>
                    )}

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
                    {isQuickClips && isProcessing && (
                        <p className="text-xs text-gray-400 mt-1 truncate">
                            {processingStage.stage} • {Math.round(processingStage.progress)}% complete
                        </p>
                    )}
                    {isQuickClips && isCompleted && clipCount > 0 && (
                        <p className="text-xs text-emerald-600 font-medium mt-1">
                            {clipCount} clip{clipCount !== 1 && 's'} generated
                        </p>
                    )}
                </div>
            </div>
        </div>
    )
}
