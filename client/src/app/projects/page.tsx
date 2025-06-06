'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { apiPath } from '@/lib/config'
import { Project } from '@/types/projects'
import { 
    Clock, 
    CheckCircle2, 
    AlertCircle, 
    Loader2, 
    Sparkles, 
    Play, 
    Download,
    Eye,
    FileVideo,
    Calendar,
    Zap,
    ArrowLeft,
    RefreshCw
} from 'lucide-react'

// Processing status component
const ProcessingStatusBadge = ({ project }: { project: Project }) => {
    const getStatusDisplay = () => {
        switch (project.processing_status) {
            case 'queued':
                return {
                    icon: <Clock className="w-4 h-4" />,
                    label: 'Queued',
                    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
                    pulse: true
                }
            case 'processing':
                return {
                    icon: <Loader2 className="w-4 h-4 animate-spin" />,
                    label: 'Processing',
                    color: 'bg-blue-100 text-blue-800 border-blue-200',
                    pulse: true
                }
            case 'completed':
                return {
                    icon: <CheckCircle2 className="w-4 h-4" />,
                    label: 'Completed',
                    color: 'bg-green-100 text-green-800 border-green-200',
                    pulse: false
                }
            case 'failed':
                return {
                    icon: <AlertCircle className="w-4 h-4" />,
                    label: 'Failed',
                    color: 'bg-red-100 text-red-800 border-red-200',
                    pulse: false
                }
            default:
                return {
                    icon: <FileVideo className="w-4 h-4" />,
                    label: 'Ready',
                    color: 'bg-gray-100 text-gray-800 border-gray-200',
                    pulse: false
                }
        }
    }

    const status = getStatusDisplay()

    return (
        <div className={`
            inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium border
            ${status.color} ${status.pulse ? 'animate-pulse' : ''}
        `}>
            {status.icon}
            {status.label}
            {project.processing_progress && project.processing_progress > 0 && (
                <span className="text-xs">({project.processing_progress}%)</span>
            )}
        </div>
    )
}

// Project card component
const ProjectCard = ({ project, isHighlighted, onViewClips }: { 
    project: Project
    isHighlighted: boolean
    onViewClips: (project: Project) => void 
}) => {
    const router = useRouter()
    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        })
    }

    const getFormatInfo = () => {
        const format = project.processing_data?.videoFormat
        if (format === 'short') {
            return { name: 'Short Vertical', ratio: '9:16', icon: '📱' }
        } else if (format === 'long') {
            return { name: 'Long Horizontal', ratio: '16:9', icon: '🖥️' }
        }
        return { name: 'Standard', ratio: '16:9', icon: '🎬' }
    }

    const formatInfo = getFormatInfo()
    const clipCount = project.processing_result?.clips?.length || 0

    return (
        <div className={`
            bg-white rounded-2xl p-6 shadow-lg border-2 transition-all duration-300 hover:shadow-xl
            ${isHighlighted ? 'border-blue-500 ring-4 ring-blue-100' : 'border-gray-200 hover:border-blue-300'}
        `}>
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                        {project.name}
                    </h3>
                    <div className="flex items-center gap-3 text-sm text-gray-600 mb-3">
                        <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {formatDate(project.created_at)}
                        </div>
                        <div className="flex items-center gap-1">
                            <span>{formatInfo.icon}</span>
                            {formatInfo.name}
                        </div>
                    </div>
                    <ProcessingStatusBadge project={project} />
                </div>

                {project.thumbnail_url && (
                    <div className="w-20 h-20 bg-gray-100 rounded-xl overflow-hidden ml-4">
                        <img 
                            src={project.thumbnail_url} 
                            alt={project.name}
                            className="w-full h-full object-cover"
                        />
                    </div>
                )}
            </div>

            {/* Processing Info */}
            {project.processing_status !== 'idle' && (
                <div className="mb-4 p-4 bg-gray-50 rounded-xl">
                    {project.processing_message && (
                        <p className="text-sm text-gray-700 mb-2">
                            {project.processing_message}
                        </p>
                    )}
                    
                    {project.processing_progress && project.processing_progress > 0 && (
                        <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                            <div 
                                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${project.processing_progress}%` }}
                            />
                        </div>
                    )}

                    {project.processing_error && (
                        <p className="text-sm text-red-600 mt-2">
                            Error: {project.processing_error}
                        </p>
                    )}
                </div>
            )}

            {/* Results */}
            {project.processing_status === 'completed' && clipCount > 0 && (
                <div className="mb-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200">
                    <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-5 h-5 text-green-600" />
                        <span className="font-semibold text-green-800">
                            {clipCount} clips generated!
                        </span>
                    </div>
                    <p className="text-sm text-green-700">
                        AI has extracted the best moments from your video
                    </p>
                </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-4 border-t border-gray-100">
                {project.processing_status === 'completed' && clipCount > 0 ? (
                    <button
                        onClick={() => onViewClips(project)}
                        className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium px-4 py-2 rounded-xl transition-all duration-200"
                    >
                        <Play className="w-4 h-4" />
                        View Clips
                    </button>
                ) : project.processing_status === 'idle' ? (
                    <button
                        onClick={() => router.push(`/projects/${project.id}`)}
                        className="flex-1 flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium px-4 py-2 rounded-xl transition-all duration-200"
                    >
                        <Eye className="w-4 h-4" />
                        Open Project
                    </button>
                ) : (
                    <button
                        disabled
                        className="flex-1 flex items-center justify-center gap-2 bg-gray-100 text-gray-500 font-medium px-4 py-2 rounded-xl cursor-not-allowed"
                    >
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processing...
                    </button>
                )}
            </div>
        </div>
    )
}

// Clips modal component
const ClipsModal = ({ project, onClose }: { project: Project, onClose: () => void }) => {
    const clips = project.processing_result?.clips || []

    const handleDownload = (clip: any) => {
        if (clip.downloadUrl && clip.downloadUrl !== '#') {
            window.open(clip.downloadUrl, '_blank')
        }
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-1">
                                Generated Clips
                            </h2>
                            <p className="text-gray-600">
                                {clips.length} clips from {project.name}
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                        >
                            <ArrowLeft className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Clips Grid */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                    <div className="grid gap-4">
                        {clips.map((clip: any, index: number) => (
                            <div key={index} className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                                <div className="flex items-start gap-4">
                                    {/* Thumbnail */}
                                    <div className="w-32 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                                        <img 
                                            src={clip.thumbnailUrl} 
                                            alt={clip.title}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1">
                                        <h3 className="font-semibold text-gray-900 mb-2">
                                            {clip.title}
                                        </h3>
                                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                                            {clip.description}
                                        </p>
                                        <div className="flex items-center gap-4 text-xs text-gray-500">
                                            <span>Duration: {Math.round(clip.duration)}s</span>
                                            <span>Score: {clip.viral_score}/10</span>
                                            <span className="capitalize">{clip.category}</span>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex flex-col gap-2">
                                        <button
                                            onClick={() => handleDownload(clip)}
                                            disabled={!clip.downloadUrl || clip.downloadUrl === '#'}
                                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-sm px-3 py-1 rounded-lg transition-colors"
                                        >
                                            <Download className="w-3 h-3" />
                                            Download
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

// Main projects page
export default function ProjectsPage() {
    const { user, session, signIn } = useAuth()
    const router = useRouter()
    const searchParams = useSearchParams()
    const highlightId = searchParams.get('highlight')

    const [projects, setProjects] = useState<Project[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [selectedProject, setSelectedProject] = useState<Project | null>(null)
    const [refreshing, setRefreshing] = useState(false)

    // Auto-refresh for processing projects
    useEffect(() => {
        if (!user || !session) return

        const fetchProjects = async () => {
            try {
                const response = await fetch(apiPath('projects'), {
                    headers: {
                        'Authorization': `Bearer ${session.access_token}`
                    }
                })

                if (!response.ok) {
                    throw new Error('Failed to fetch projects')
                }

                const data = await response.json()
                setProjects(data)
                setError(null)
            } catch (err) {
                console.error('Error fetching projects:', err)
                setError(err instanceof Error ? err.message : 'Failed to load projects')
            } finally {
                setLoading(false)
                setRefreshing(false)
            }
        }

        fetchProjects()

        // Auto-refresh every 5 seconds if there are processing projects
        const hasProcessingProjects = projects.some(p => 
            ['queued', 'processing'].includes(p.processing_status || '')
        )

        let interval: NodeJS.Timeout | null = null
        if (hasProcessingProjects) {
            interval = setInterval(fetchProjects, 5000)
        }

        return () => {
            if (interval) clearInterval(interval)
        }
    }, [user, session, projects.some(p => ['queued', 'processing'].includes(p.processing_status || ''))])

    const handleRefresh = async () => {
        setRefreshing(true)
        // The useEffect will handle the actual refresh
    }

    const handleViewClips = (project: Project) => {
        setSelectedProject(project)
    }

    if (!user) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-gray-900 mb-4">Sign in Required</h1>
                    <p className="text-gray-600 mb-6">You need to sign in to view your projects</p>
                    <button
                        onClick={signIn}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium"
                    >
                        Sign In
                    </button>
                </div>
            </div>
        )
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
                    <p className="text-gray-600">Loading your projects...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => router.push('/')}
                                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                            >
                                <ArrowLeft className="w-6 h-6" />
                            </button>
                            <div>
                                <h1 className="text-3xl font-bold text-gray-900">Your Projects</h1>
                                <p className="text-gray-600 mt-1">
                                    {projects.length} projects • {projects.filter(p => p.processing_status === 'completed').length} completed
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleRefresh}
                                disabled={refreshing}
                                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
                            >
                                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                                Refresh
                            </button>
                            <button
                                onClick={() => router.push('/')}
                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl transition-colors"
                            >
                                <Zap className="w-4 h-4" />
                                Create New
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                        <p className="text-red-800">{error}</p>
                    </div>
                )}

                {projects.length === 0 ? (
                    <div className="text-center py-12">
                        <FileVideo className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <h2 className="text-xl font-semibold text-gray-900 mb-2">No projects yet</h2>
                        <p className="text-gray-600 mb-6">Create your first Quickclips project to get started</p>
                        <button
                            onClick={() => router.push('/')}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium"
                        >
                            Create Your First Project
                        </button>
                    </div>
                ) : (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {projects.map((project) => (
                            <ProjectCard
                                key={project.id}
                                project={project}
                                isHighlighted={project.id === highlightId}
                                onViewClips={handleViewClips}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Clips Modal */}
            {selectedProject && (
                <ClipsModal
                    project={selectedProject}
                    onClose={() => setSelectedProject(null)}
                />
            )}
        </div>
    )
} 