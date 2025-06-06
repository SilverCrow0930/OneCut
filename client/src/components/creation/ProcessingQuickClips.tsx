import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { apiPath } from '@/lib/config'
import { Project } from '@/types/projects'
import { Zap, Bot, Clock, Video, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react'

export default function ProcessingQuickClips() {
    const router = useRouter()
    const { session } = useAuth()
    const [processingProjects, setProcessingProjects] = useState<Project[]>([])
    const [loading, setLoading] = useState(true)
    const [allProjects, setAllProjects] = useState<Project[]>([]) // Debug: store all projects

    useEffect(() => {
        if (!session?.access_token) {
            setLoading(false)
            return
        }

        let intervalId: NodeJS.Timeout | null = null

        async function loadProcessingProjects() {
            try {
                const res = await fetch(apiPath('projects'), {
                    headers: {
                        Authorization: `Bearer ${session?.access_token}`,
                    },
                })
                
                if (res.ok) {
                    const allProjectsData: Project[] = await res.json()
                    console.log('🔍 All projects loaded:', allProjectsData)
                    setAllProjects(allProjectsData) // Debug: store all projects
                    
                    const quickClipsProjects = allProjectsData.filter(p => 
                        p.type === 'quickclips' && 
                        (p.processing_status === 'processing' || p.processing_status === 'completed')
                    )
                    console.log('🎬 QuickClips projects found:', quickClipsProjects)
                    setProcessingProjects(quickClipsProjects)

                    // Set up polling if there are processing projects
                    const hasActiveProcessing = quickClipsProjects.some(p => p.processing_status === 'processing')
                    if (hasActiveProcessing && !intervalId) {
                        intervalId = setInterval(loadProcessingProjects, 2000) // Poll every 2 seconds
                    } else if (!hasActiveProcessing && intervalId) {
                        clearInterval(intervalId)
                        intervalId = null
                    }
                } else {
                    console.error('❌ Failed to load projects:', res.status, res.statusText)
                }
            } catch (error) {
                console.error('❌ Error loading processing projects:', error)
            } finally {
                setLoading(false)
            }
        }

        loadProcessingProjects()

        return () => {
            if (intervalId) {
                clearInterval(intervalId)
            }
        }
    }, [session?.access_token])

    const handleProjectClick = (project: Project) => {
        if (project.processing_status === 'completed') {
            router.push(`/projects/${project.id}/quickclips`)
        }
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'processing':
                return <Bot className="w-5 h-5 text-blue-600 animate-pulse" />
            case 'completed':
                return <CheckCircle className="w-5 h-5 text-green-600" />
            case 'error':
                return <AlertCircle className="w-5 h-5 text-red-600" />
            default:
                return <Clock className="w-5 h-5 text-gray-600" />
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'processing':
                return 'bg-blue-50 border-blue-200 text-blue-800'
            case 'completed':
                return 'bg-green-50 border-green-200 text-green-800 cursor-pointer hover:bg-green-100'
            case 'error':
                return 'bg-red-50 border-red-200 text-red-800'
            default:
                return 'bg-gray-50 border-gray-200 text-gray-800'
        }
    }

    const getStatusText = (status: string) => {
        switch (status) {
            case 'processing':
                return 'Processing...'
            case 'completed':
                return 'Ready to View'
            case 'error':
                return 'Failed'
            default:
                return 'Unknown'
        }
    }

    // Debug: Always show the section when we have session to debug
    if (!session?.access_token) {
        return null
    }

    if (loading) {
        return (
            <div className="mb-12">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-emerald-100 rounded-lg">
                        <Zap className="w-5 h-5 text-emerald-600" />
                    </div>
                    <h2 className="text-xl font-semibold text-gray-900">AI Clips Processing</h2>
                    <div className="flex-1 h-px bg-gradient-to-r from-gray-300 to-transparent"></div>
                </div>
                <div className="p-6 rounded-xl border-2 bg-gray-50 border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600"></div>
                        <span className="text-gray-600">Loading AI projects...</span>
                    </div>
                </div>
            </div>
        )
    }

    // Debug: Show debug info when no processing projects
    if (processingProjects.length === 0) {
        return (
            <div className="mb-12">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-gray-100 rounded-lg">
                        <Zap className="w-5 h-5 text-gray-600" />
                    </div>
                    <h2 className="text-xl font-semibold text-gray-900">AI Clips Processing</h2>
                    <div className="flex-1 h-px bg-gradient-to-r from-gray-300 to-transparent"></div>
                </div>
                <div className="p-6 rounded-xl border-2 bg-yellow-50 border-yellow-200">
                    <div className="text-center">
                        <p className="text-sm text-gray-600 mb-2">
                            🔍 Debug: No processing projects found
                        </p>
                        <p className="text-xs text-gray-500 mb-4">
                            Total projects: {allProjects.length} | 
                            QuickClips projects: {allProjects.filter(p => p.type === 'quickclips').length} |
                            Processing projects: {allProjects.filter(p => p.processing_status === 'processing').length}
                        </p>
                        {allProjects.length > 0 && (
                            <details className="text-left">
                                <summary className="cursor-pointer text-xs text-blue-600">Show all projects (debug)</summary>
                                <pre className="text-xs bg-gray-100 p-2 rounded mt-2 overflow-auto">
                                    {JSON.stringify(allProjects.map(p => ({
                                        id: p.id,
                                        name: p.name,
                                        type: p.type,
                                        processing_status: p.processing_status
                                    })), null, 2)}
                                </pre>
                            </details>
                        )}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="mb-12">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-emerald-100 rounded-lg">
                    <Zap className="w-5 h-5 text-emerald-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">AI Clips Processing</h2>
                <div className="flex-1 h-px bg-gradient-to-r from-gray-300 to-transparent"></div>
            </div>

            <div className="grid gap-4">
                {processingProjects.map((project) => (
                    <div
                        key={project.id}
                        onClick={() => handleProjectClick(project)}
                        className={`
                            p-6 rounded-xl border-2 transition-all duration-300
                            ${getStatusColor(project.processing_status || 'idle')}
                            ${project.processing_status === 'completed' ? 'transform hover:scale-[1.02]' : ''}
                        `}
                    >
                        <div className="flex items-center gap-4">
                            {/* Icon */}
                            <div className="flex-shrink-0">
                                {getStatusIcon(project.processing_status || 'idle')}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3 mb-2">
                                    <h3 className="font-semibold text-gray-900 truncate">
                                        {project.name}
                                    </h3>
                                    <span className="text-sm font-medium">
                                        {getStatusText(project.processing_status || 'idle')}
                                    </span>
                                </div>
                                
                                {project.processing_message && (
                                    <p className="text-sm text-gray-600 mb-2">
                                        {project.processing_message}
                                    </p>
                                )}

                                <div className="flex items-center gap-4 text-xs text-gray-500">
                                    <div className="flex items-center gap-1">
                                        <Video className="w-3 h-3" />
                                        <span>{project.quickclips_data?.contentType || 'Unknown'} content</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        <span>Started {new Date(project.created_at).toLocaleTimeString()}</span>
                                    </div>
                                    {project.processing_status === 'completed' && project.quickclips_data?.clips && (
                                        <div className="flex items-center gap-1">
                                            <Zap className="w-3 h-3" />
                                            <span>{project.quickclips_data.clips.length} clips ready</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Action */}
                            {project.processing_status === 'completed' && (
                                <div className="flex-shrink-0">
                                    <div className="flex items-center gap-2 text-sm font-medium text-green-700">
                                        <span>View Clips</span>
                                        <ArrowRight className="w-4 h-4" />
                                    </div>
                                </div>
                            )}

                            {/* Progress indicator for processing */}
                            {project.processing_status === 'processing' && (
                                <div className="flex-shrink-0">
                                    <div className="w-8 h-8 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin"></div>
                                </div>
                            )}
                        </div>

                        {/* Progress bar for processing */}
                        {project.processing_status === 'processing' && (
                            <div className="mt-4">
                                <div className="bg-blue-200 rounded-full h-2">
                                    <div 
                                        className="bg-blue-600 h-2 rounded-full transition-all duration-500 animate-pulse"
                                        style={{ width: '60%' }} // Could be dynamic based on actual progress
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Help text */}
            <div className="mt-4 text-center">
                <p className="text-sm text-gray-600">
                    {processingProjects.some(p => p.processing_status === 'processing') ? (
                        <>
                            <Bot className="w-4 h-4 inline mr-1" />
                            AI is working on your clips in the background. You can navigate away and come back later.
                        </>
                    ) : (
                        <>
                            <CheckCircle className="w-4 h-4 inline mr-1" />
                            Your clips are ready! Click on a project above to view and download.
                        </>
                    )}
                </p>
            </div>
        </div>
    )
} 