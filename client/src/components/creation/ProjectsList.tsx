import React, { useEffect, useState } from 'react'
import { apiPath } from '@/lib/config'
import { useAuth } from '@/contexts/AuthContext'
import { Project } from '@/types/projects'
import { formatSecondsAsTimestamp } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { Clock, Play, Folder, MoreHorizontal, Download, Copy, Trash2, Zap, Video, Eye } from 'lucide-react'

interface ProjectsListProps {
    defaultTab?: 'all' | 'quickclips'
    highlightProjectId?: string
}

export default function ProjectsList({ defaultTab = 'all', highlightProjectId }: ProjectsListProps) {
    const router = useRouter()
    const { session } = useAuth()
    const [projects, setProjects] = useState<Project[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [showMenu, setShowMenu] = useState<string | null>(null)
    const [activeTab, setActiveTab] = useState<'all' | 'quickclips'>(defaultTab)
    const [selectedQuickClipProject, setSelectedQuickClipProject] = useState<Project | null>(null)

    // Filter projects based on active tab
    const filteredProjects = projects.filter(project => {
        if (activeTab === 'quickclips') {
            return project.processing_type === 'quickclips'
        }
        return true // 'all' shows everything
    })

    const quickClipsProjects = projects.filter(p => p.processing_type === 'quickclips')

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

    const handleProjectClick = (project: Project) => {
        if (showMenu) {
            setShowMenu(null)
            return
        }
        
        // If it's a QuickClips project and we're in QuickClips tab, show clips
        if (activeTab === 'quickclips' && project.processing_type === 'quickclips') {
            setSelectedQuickClipProject(project)
            return
        }
        
        router.push(`/projects/${project.id}`)
    }

    const renderQuickClipsView = () => {
        if (!selectedQuickClipProject) return null

        const clips = selectedQuickClipProject.processing_result?.clips || []

        return (
            <div className="space-y-6">
                {/* Back Button */}
                <button
                    onClick={() => setSelectedQuickClipProject(null)}
                    className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
                >
                    ← Back to QuickClips
                </button>

                {/* Project Header */}
                <div className="bg-white rounded-xl p-6 shadow-sm border">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                        {selectedQuickClipProject.name || 'QuickClips Project'}
                    </h2>
                    <p className="text-gray-600">
                        {clips.length} clips generated • {selectedQuickClipProject.processing_result?.contentType || 'Unknown'} content
                    </p>
                </div>

                {/* Clips Grid */}
                {clips.length > 0 ? (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {clips.map((clip: any, index: number) => (
                            <div key={index} className="bg-white rounded-xl overflow-hidden shadow-sm border hover:shadow-lg transition-all duration-300">
                                {/* Thumbnail */}
                                <div className="relative group">
                                    <img
                                        src={clip.thumbnailUrl || '/placeholder-video.jpg'}
                                        alt={clip.title}
                                        className="w-full h-48 object-cover"
                                    />
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <button 
                                            onClick={() => window.open(clip.downloadUrl, '_blank')}
                                            className="bg-white/20 hover:bg-white/30 rounded-full p-3 backdrop-blur-sm transition-all transform hover:scale-110"
                                        >
                                            <Play className="w-6 h-6 text-white" />
                                        </button>
                                    </div>
                                    {/* Duration Badge */}
                                    <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
                                        {Math.round(clip.duration)}s
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="p-4">
                                    <h3 className="font-medium text-gray-900 mb-1 line-clamp-2">{clip.title}</h3>
                                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">{clip.description}</p>
                                    
                                    {/* Actions */}
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => window.open(clip.downloadUrl, '_blank')}
                                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                                        >
                                            <Download className="w-4 h-4" />
                                            Download
                                        </button>
                                        <button
                                            onClick={() => window.open(clip.previewUrl || clip.downloadUrl, '_blank')}
                                            className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors"
                                        >
                                            <Eye className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12">
                        <p className="text-gray-500">No clips available for this project</p>
                    </div>
                )}
            </div>
        )
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

    // If viewing QuickClips details, show that view
    if (selectedQuickClipProject) {
        return renderQuickClipsView()
    }

    return (
        <div className="space-y-6">
            {/* Tabs */}
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg max-w-md">
                <button
                    onClick={() => setActiveTab('all')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                        activeTab === 'all'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                    }`}
                >
                    <Folder className="w-4 h-4" />
                    All Projects ({projects.length})
                </button>
                <button
                    onClick={() => setActiveTab('quickclips')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                        activeTab === 'quickclips'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                    }`}
                >
                    <Zap className="w-4 h-4" />
                    QuickClips ({quickClipsProjects.length})
                </button>
            </div>

            {/* Content */}
            {filteredProjects.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-20 h-20 mb-6 text-gray-300">
                        {activeTab === 'quickclips' ? (
                            <Zap className="w-full h-full" strokeWidth={1} />
                        ) : (
                            <Folder className="w-full h-full" strokeWidth={1} />
                        )}
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                        {activeTab === 'quickclips' ? 'No QuickClips yet' : 'No projects yet'}
                    </h3>
                    <p className="text-gray-500 max-w-sm">
                        {activeTab === 'quickclips' 
                            ? 'Create your first AI-powered video clips by uploading a video above.'
                            : 'Start creating amazing videos by making your first project. Click "Create New Project" to get started.'
                        }
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredProjects.map((project) => (
                        <ProjectCard
                            key={project.id}
                            project={project}
                            onClick={() => handleProjectClick(project)}
                            onMenuClick={(e) => handleMenuClick(e, project.id)}
                            onDownload={(e) => handleDownload(e, project)}
                            onDuplicate={(e) => handleDuplicate(e, project)}
                            onDelete={(e) => handleDelete(e, project)}
                            showMenu={showMenu === project.id}
                            isQuickClipsMode={activeTab === 'quickclips'}
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
    onClick: () => void
    onMenuClick: (e: React.MouseEvent) => void
    onDownload: (e: React.MouseEvent) => void
    onDuplicate: (e: React.MouseEvent) => void
    onDelete: (e: React.MouseEvent) => void
    showMenu: boolean
    isQuickClipsMode: boolean
}

function ProjectCard({ 
    project, 
    onClick, 
    onMenuClick, 
    onDownload, 
    onDuplicate, 
    onDelete, 
    showMenu,
    isQuickClipsMode 
}: ProjectCardProps) {
    const getStatusBadge = () => {
        if (project.processing_status === 'processing') {
            return (
                <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                    Processing
                </div>
            )
        }
        if (project.processing_status === 'completed') {
            return (
                <div className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    {isQuickClipsMode ? `${project.processing_result?.clips?.length || 0} clips` : 'Completed'}
                </div>
            )
        }
        if (project.processing_status === 'failed') {
            return (
                <div className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    Failed
                </div>
            )
        }
        return null
    }

    return (
        <div 
            className="relative bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-lg hover:border-gray-300 transition-all duration-300 cursor-pointer group"
            onClick={onClick}
        >
            {/* Status Badge */}
            <div className="absolute top-3 left-3 z-10">
                {getStatusBadge()}
            </div>

            {/* Menu Button */}
            <div className="absolute top-3 right-3 z-10">
                <button
                    onClick={onMenuClick}
                    className="p-2 rounded-lg bg-white/80 hover:bg-white shadow-sm opacity-0 group-hover:opacity-100 transition-all duration-200"
                >
                    <MoreHorizontal className="w-4 h-4 text-gray-600" />
                </button>
                
                {/* Dropdown Menu */}
                {showMenu && (
                    <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                        <button
                            onClick={onDownload}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                            <Download className="w-4 h-4" />
                            Download
                        </button>
                        <button
                            onClick={onDuplicate}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                            <Copy className="w-4 h-4" />
                            Duplicate
                        </button>
                        <button
                            onClick={onDelete}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                        >
                            <Trash2 className="w-4 h-4" />
                            Delete
                        </button>
                    </div>
                )}
            </div>

            {/* Thumbnail/Preview */}
            <div className="aspect-video bg-gradient-to-br from-blue-50 to-purple-50 rounded-t-xl flex items-center justify-center">
                {isQuickClipsMode ? (
                    <Zap className="w-12 h-12 text-blue-500" />
                ) : (
                    <Video className="w-12 h-12 text-gray-400" />
                )}
            </div>

            {/* Content */}
            <div className="p-4">
                <h3 className="font-semibold text-gray-900 mb-1 line-clamp-1">
                    {project.name || 'Untitled Project'}
                </h3>
                
                {project.processing_type === 'quickclips' && project.processing_result?.description && (
                    <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                        {project.processing_result.description}
                    </p>
                )}

                <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Clock className="w-3 h-3" />
                    <span>
                        {project.updated_at 
                            ? new Date(project.updated_at).toLocaleDateString()
                            : 'Unknown date'
                        }
                    </span>
                    {isQuickClipsMode && project.processing_result?.contentType && (
                        <>
                            <span>•</span>
                            <span className="capitalize">{project.processing_result.contentType}</span>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
