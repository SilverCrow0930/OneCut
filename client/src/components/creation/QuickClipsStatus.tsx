import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { apiPath } from '@/lib/config'
import { Project } from '@/types/projects'
import { Zap, Bot, CheckCircle, AlertCircle, Clock, Play, ArrowRight, Sparkles } from 'lucide-react'

const QuickClipsStatus = () => {
    const router = useRouter()
    const { session } = useAuth()
    const [quickClipsProjects, setQuickClipsProjects] = useState<Project[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!session?.access_token) {
            setLoading(false)
            return
        }

        let intervalId: NodeJS.Timeout | null = null

        const loadQuickClipsProjects = async () => {
            try {
                const response = await fetch(apiPath('projects'), {
                    headers: {
                        'Authorization': `Bearer ${session.access_token}`
                    }
                })

                if (response.ok) {
                    const projects: Project[] = await response.json()
                    const quickClips = projects.filter(p => 
                        p.type === 'quickclips' && 
                        (p.processing_status === 'processing' || p.processing_status === 'completed')
                    )
                    setQuickClipsProjects(quickClips)

                    // Set up polling if there are processing projects
                    const hasProcessing = quickClips.some(p => p.processing_status === 'processing')
                    if (hasProcessing && !intervalId) {
                        intervalId = setInterval(loadQuickClipsProjects, 3000)
                    } else if (!hasProcessing && intervalId) {
                        clearInterval(intervalId)
                        intervalId = null
                    }
                }
            } catch (error) {
                console.error('Error loading QuickClips projects:', error)
            } finally {
                setLoading(false)
            }
        }

        loadQuickClipsProjects()

        return () => {
            if (intervalId) {
                clearInterval(intervalId)
            }
        }
    }, [session])

    const handleProjectClick = (project: Project) => {
        if (project.processing_status === 'completed') {
            router.push(`/projects/${project.id}/quickclips`)
        }
    }

    const getStatusConfig = (status: string) => {
        switch (status) {
            case 'processing':
                return {
                    icon: Bot,
                    label: 'Processing',
                    color: 'text-blue-600',
                    bg: 'bg-blue-50',
                    border: 'border-blue-200',
                    animated: true
                }
            case 'completed':
                return {
                    icon: CheckCircle,
                    label: 'Ready',
                    color: 'text-green-600',
                    bg: 'bg-green-50',
                    border: 'border-green-200',
                    animated: false
                }
            case 'error':
                return {
                    icon: AlertCircle,
                    label: 'Failed',
                    color: 'text-red-600',
                    bg: 'bg-red-50',
                    border: 'border-red-200',
                    animated: false
                }
            default:
                return {
                    icon: Clock,
                    label: 'Idle',
                    color: 'text-gray-600',
                    bg: 'bg-gray-50',
                    border: 'border-gray-200',
                    animated: false
                }
        }
    }

    const formatTimeAgo = (dateString: string) => {
        const now = new Date()
        const date = new Date(dateString)
        const diffMs = now.getTime() - date.getTime()
        const diffMins = Math.floor(diffMs / (1000 * 60))
        
        if (diffMins < 1) return 'Just now'
        if (diffMins < 60) return `${diffMins}m ago`
        
        const diffHours = Math.floor(diffMins / 60)
        if (diffHours < 24) return `${diffHours}h ago`
        
        const diffDays = Math.floor(diffHours / 24)
        return `${diffDays}d ago`
    }

    if (loading) {
        return (
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-emerald-100 rounded-lg">
                        <Zap className="w-5 h-5 text-emerald-600" />
                    </div>
                    <h2 className="text-lg font-semibold text-gray-900">AI Clips</h2>
                </div>
                <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600"></div>
                </div>
            </div>
        )
    }

    if (quickClipsProjects.length === 0) {
        return null // Don't show the section if no QuickClips projects
    }

    return (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-emerald-50 to-teal-50">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 rounded-lg">
                        <Zap className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">AI Clips</h2>
                        <p className="text-sm text-gray-600">Your AI-generated video clips</p>
                    </div>
                    <div className="ml-auto">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Sparkles className="w-4 h-4" />
                            <span>{quickClipsProjects.length} project{quickClipsProjects.length !== 1 ? 's' : ''}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Projects List */}
            <div className="divide-y divide-gray-100">
                {quickClipsProjects.map((project) => {
                    const statusConfig = getStatusConfig(project.processing_status || 'idle')
                    const StatusIcon = statusConfig.icon
                    const isClickable = project.processing_status === 'completed'
                    const clipCount = project.quickclips_data?.clips?.length || 0

                    return (
                        <div
                            key={project.id}
                            onClick={() => handleProjectClick(project)}
                            className={`
                                p-6 transition-all duration-200
                                ${isClickable ? 'hover:bg-gray-50 cursor-pointer group' : 'cursor-default'}
                            `}
                        >
                            <div className="flex items-center gap-4">
                                {/* Status Icon */}
                                <div className={`
                                    p-3 rounded-xl border-2 ${statusConfig.bg} ${statusConfig.border}
                                    ${statusConfig.animated ? 'animate-pulse' : ''}
                                `}>
                                    <StatusIcon className={`w-6 h-6 ${statusConfig.color}`} />
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-2">
                                        <h3 className="font-semibold text-gray-900 truncate">
                                            {project.name}
                                        </h3>
                                        <div className={`
                                            inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium
                                            ${statusConfig.bg} ${statusConfig.color}
                                        `}>
                                            <StatusIcon className={`w-3 h-3 ${statusConfig.animated ? 'animate-pulse' : ''}`} />
                                            {statusConfig.label}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 text-sm text-gray-600">
                                        <div className="flex items-center gap-1">
                                            <Clock className="w-4 h-4" />
                                            <span>{formatTimeAgo(project.updated_at)}</span>
                                        </div>
                                        
                                        {project.processing_status === 'completed' && clipCount > 0 && (
                                            <div className="flex items-center gap-1">
                                                <Play className="w-4 h-4" />
                                                <span>{clipCount} clip{clipCount !== 1 ? 's' : ''} ready</span>
                                            </div>
                                        )}

                                        {project.quickclips_data?.contentType && (
                                            <div className="flex items-center gap-1">
                                                <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                                                <span className="capitalize">{project.quickclips_data.contentType.replace('_', ' ')}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Processing Message */}
                                    {project.processing_message && project.processing_status === 'processing' && (
                                        <div className="mt-2">
                                            <p className="text-sm text-blue-600">{project.processing_message}</p>
                                        </div>
                                    )}

                                    {/* Clips Preview for Completed */}
                                    {project.processing_status === 'completed' && project.quickclips_data?.clips && (
                                        <div className="mt-3">
                                            <div className="flex items-center gap-2">
                                                {project.quickclips_data.clips.slice(0, 3).map((clip: any, index: number) => (
                                                    <div key={index} className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-lg text-xs">
                                                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                                                        <span className="truncate max-w-16">{clip.title}</span>
                                                    </div>
                                                ))}
                                                {project.quickclips_data.clips.length > 3 && (
                                                    <div className="text-xs text-gray-500">
                                                        +{project.quickclips_data.clips.length - 3} more
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Action Arrow for Completed */}
                                {isClickable && (
                                    <div className="flex items-center text-gray-400 group-hover:text-emerald-600 transition-colors">
                                        <ArrowRight className="w-5 h-5" />
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

export default QuickClipsStatus 