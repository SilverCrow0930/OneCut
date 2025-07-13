'use client'

import React, { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { apiPath } from '@/lib/config'
import { ArrowLeft, Download, Play, Edit, Share, Zap, Clock, Star } from 'lucide-react'
import HomeNavbar from '@/components/home/HomeNavbar'

interface QuickClip {
    id: string
    title: string
    description: string
    start_time: number
    end_time: number
    duration: number
    significance: number
    narrative_role: string
    transition_note: string
    downloadUrl: string
    previewUrl: string
    thumbnailUrl: string
    format: string
    aspectRatio: string
}

interface ProjectData {
    id: string
    name: string
    processing_status?: string
    processing_progress?: number
    processing_message?: string
    processing_result?: {
        clips: QuickClip[]
        description?: string
        processingTime?: number
        videoFormat?: string
        contentType?: string
    }
}

export default function QuickClipsViewPage() {
    const params = useParams()
    const router = useRouter()
    const { session } = useAuth()
    const [project, setProject] = useState<ProjectData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    
    // Add visual progress state separate from project progress
    const [visualProgress, setVisualProgress] = useState(0)
    
    // Polling state
    const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
    const isPollingRef = useRef(false)
    const pollCountRef = useRef(0)
    const projectIdRef = useRef<string>(typeof params.projectId === 'string' ? params.projectId : 
        Array.isArray(params.projectId) ? params.projectId[0] : '')

    // Get project ID from params
    const projectId = Array.isArray(params.projectId) ? params.projectId[0] : 
        (params.projectId as string)

    // Update project ID ref when it changes
    useEffect(() => {
        projectIdRef.current = projectId;
    }, [projectId]);

    const fetchProject = async () => {
        if (!session?.access_token || !projectId) return;

        try {
            if (!loading) {
                console.log('[QuickClips] Polling project status...')
            }
            
            // Log the full API URL being called for debugging
            const apiUrl = apiPath(`projects/${projectId}`);
            console.log('[QuickClips] API URL:', apiUrl);
            
            const response = await fetch(apiUrl, {
                headers: {
                    'Authorization': `Bearer ${session?.access_token}`
                }
            })

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[QuickClips] API error:', response.status, errorText);
                throw new Error('Failed to fetch project')
            }

            const data = await response.json()
            console.log('[QuickClips] Project data received:', data);
            setProject(data)
            
            console.log('[QuickClips] Project status:', {
                processing_status: data.processing_status,
                processing_progress: data.processing_progress,
                clips_count: data.processing_result?.clips?.length || 0
            })
            
        } catch (error) {
            console.error('Error fetching project:', error)
            setError(error instanceof Error ? error.message : 'Failed to load project')
        } finally {
            setLoading(false)
        }
    }

    // Start polling when project is processing
    const startPolling = () => {
        if (isPollingRef.current) return // Already polling
        
        console.log('[QuickClips] Starting polling for project status updates')
        isPollingRef.current = true
        pollCountRef.current = 0;
        
        // First poll quickly for immediate feedback
        fetchProject();
        
        // Then set up interval
        scheduleNextPoll();
    }
    
    // Schedule the next poll with adaptive timing
    const scheduleNextPoll = () => {
        // Clear any existing timeout
        if (pollingIntervalRef.current) {
            clearTimeout(pollingIntervalRef.current);
        }
        
        // Calculate poll interval - more frequent at first, then slower
        let interval = 2000; // Default 2 seconds
        
        if (pollCountRef.current < 3) {
            // First few polls: very quick (1s)
            interval = 1000;
        } else if (pollCountRef.current < 10) {
            // Next few polls: medium pace (2s)
            interval = 2000;
        } else {
            // Later polls: slower pace (3s)
            interval = 3000;
        }
        
        pollingIntervalRef.current = setTimeout(() => {
            pollCountRef.current++;
            fetchProject();
            
            // If still polling, schedule next poll
            if (isPollingRef.current) {
                scheduleNextPoll();
            }
        }, interval);
    }

    // Stop polling
    const stopPolling = () => {
        if (pollingIntervalRef.current) {
            console.log('[QuickClips] Stopping polling')
            clearTimeout(pollingIntervalRef.current)
            pollingIntervalRef.current = null
        }
        isPollingRef.current = false
        pollCountRef.current = 0;
    }

    // Initial fetch and polling setup
    useEffect(() => {
        fetchProject()
    }, [session?.access_token, projectId])

    // Manage polling based on project status
    useEffect(() => {
        if (!project) return

        const isProcessing = project.processing_status === 'processing' || project.processing_status === 'queued'
        
        if (isProcessing && !isPollingRef.current) {
            startPolling()
        } else if (!isProcessing && isPollingRef.current) {
            stopPolling()
        }

        // Cleanup on unmount
        return () => {
            stopPolling()
        }
    }, [project?.processing_status])

    // Update visual progress whenever project progress changes
    useEffect(() => {
        if (project?.processing_progress) {
            // Gradually animate to the new progress value
            const targetProgress = project.processing_progress;
            const currentProgress = visualProgress;
            
            // Don't animate backwards
            if (targetProgress < currentProgress) {
                setVisualProgress(targetProgress);
                return;
            }
            
            // Animate progress in small increments
            const duration = 500; // animation duration in ms
            const steps = 10;
            const increment = (targetProgress - currentProgress) / steps;
            let currentStep = 0;
            
            const animateProgress = () => {
                currentStep++;
                if (currentStep <= steps) {
                    setVisualProgress(prev => Math.min(prev + increment, targetProgress));
                    requestAnimationFrame(animateProgress);
                }
            };
            
            requestAnimationFrame(animateProgress);
        } else if (project?.processing_status === 'queued') {
            // Show minimum progress for queued projects
            setVisualProgress(5);
        }
    }, [project?.processing_progress, project?.processing_status]);

    const formatDuration = (seconds: number) => {
        if (seconds < 60) {
            return `${Math.round(seconds)}s`
        } else {
            const minutes = Math.floor(seconds / 60)
            const remainingSeconds = Math.round(seconds % 60)
            return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`
        }
    }

    const handleDownload = (clip: QuickClip) => {
        window.open(clip.downloadUrl, '_blank')
    }

    const handlePreview = (clip: QuickClip) => {
        window.open(clip.previewUrl, '_blank')
    }

    const handleEdit = async (clip: QuickClip) => {
        if (!session?.access_token) {
            return
        }

        try {
            // Create a new project for editing this clip
            const response = await fetch(apiPath('projects'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({
                    name: `Edit: ${clip.title}`,
                    initial_clip_data: {
                        clipId: clip.id,
                        start_time: clip.start_time,
                        end_time: clip.end_time,
                        videoUrl: clip.previewUrl,
                        title: clip.title,
                        description: clip.description
                    }
                }),
            })

            if (!response.ok) {
                throw new Error('Failed to create project for editing')
            }

            const project = await response.json()
            
            // Navigate to the new project with clip data in URL params
            router.push(`/projects/${project.id}?clipId=${clip.id}&start=${clip.start_time}&end=${clip.end_time}&url=${encodeURIComponent(clip.previewUrl)}`)
            
        } catch (error) {
            console.error('Failed to create edit project:', error)
            alert('Failed to create project for editing. Please try again.')
        }
    }

    // Show processing state if project is still being processed
    if (project?.processing_status === 'processing' || project?.processing_status === 'queued') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
                <HomeNavbar />
                <div className="flex flex-col items-center justify-center min-h-screen p-8">
                    <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Zap className="w-8 h-8 text-blue-600" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900">Processing Smart Cut</h2>
                            <p className="text-gray-600 mt-1">{project?.processing_message || 'Analyzing your video...'}</p>
                        </div>
                        
                        <div className="w-full bg-gray-200 rounded-full h-3 mb-6">
                            <div 
                                className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-500"
                                style={{ width: `${visualProgress}%` }}
                            ></div>
                        </div>
                        
                        <p className="text-sm text-gray-500 text-center">
                            This process may take a few minutes. This page will automatically update when complete.
                        </p>

                        {/* Show progress info */}
                        <div className="mt-4 text-center">
                            <p className="text-xs text-gray-400">
                                Progress: {Math.round(visualProgress)}%
                            </p>
                            {isPollingRef.current && (
                                <div className="flex items-center justify-center gap-1 mt-2">
                                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                                    <span className="text-xs text-blue-600">Checking for updates...</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
                <HomeNavbar />
                <div className="flex items-center justify-center min-h-screen">
                    <div className="flex items-center space-x-3 text-gray-600">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <span className="text-lg">Loading Smart Cut...</span>
                    </div>
                </div>
            </div>
        )
    }

    if (error || !project) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
                <HomeNavbar />
                <div className="flex flex-col items-center justify-center min-h-screen text-center">
                    <div className="w-16 h-16 mb-4 text-red-400">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-semibold text-red-600 mb-2">Error loading Smart Cut</h2>
                    <p className="text-gray-600 mb-4">{error || 'Project not found'}</p>
                    <button
                        onClick={() => router.push('/projects')}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        Back to Projects
                    </button>
                </div>
            </div>
        )
    }

    const clips = project.processing_result?.clips || []

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
            <HomeNavbar />
            
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-16">
                {/* Header */}
                <div className="mb-8">
                    <button
                        onClick={() => router.push('/projects')}
                        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        Back to Projects
                    </button>
                    
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl">
                            <Zap className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
                            <p className="text-gray-600">
                                {clips.length} clips generated
                                {project.processing_result?.processingTime && (
                                    ` • Processed in ${Math.round(project.processing_result.processingTime / 1000)}s`
                                )}
                            </p>
                        </div>
                    </div>

                    {project.processing_result?.description && (
                        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                            <h3 className="font-semibold text-gray-900 mb-2">AI Generated Description</h3>
                            <p className="text-gray-700">{project.processing_result.description}</p>
                        </div>
                    )}
                </div>

                {/* Clips Grid */}
                {clips.length === 0 ? (
                    <div className="text-center py-16">
                        <div className="w-20 h-20 mx-auto mb-6 text-gray-300">
                            <Zap className="w-full h-full" strokeWidth={1} />
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">No clips available</h3>
                        <p className="text-gray-600">This project doesn't have any generated clips yet.</p>
                    </div>
                ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {clips.map((clip, index) => (
                            <div key={clip.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-300 group">
                                {/* Thumbnail Section */}
                                <div className="relative">
                                    <img
                                        src={clip.thumbnailUrl}
                                        alt={clip.title}
                                        className="w-full h-48 object-cover"
                                        onError={(e) => {
                                            const target = e.currentTarget;
                                            target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIwIiBoZWlnaHQ9IjE4MCIgdmlld0JveD0iMCAwIDMyMCAxODAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMjAiIGhlaWdodD0iMTgwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0xNDQgNzJMMTY4IDkwTDE0NCAxMDhWNzJaIiBmaWxsPSIjOUI5Qjk2Ii8+Cjwvc3ZnPgo=';
                                        }}
                                    />
                                    
                                    {/* Preview Overlay */}
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <button 
                                            onClick={() => handlePreview(clip)}
                                            className="bg-white/20 hover:bg-white/30 rounded-full p-3 backdrop-blur-sm transition-all transform hover:scale-110"
                                        >
                                            <Play className="w-6 h-6 text-white" />
                                        </button>
                                    </div>
                                    
                                    {/* Duration Badge */}
                                    <div className="absolute top-3 right-3 bg-black/70 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
                                        {formatDuration(clip.duration)}
                                    </div>
                                    
                                    {/* Significance Score */}
                                    <div className="absolute top-3 left-3 flex items-center gap-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
                                        <Star className="w-3 h-3" />
                                        <span>{clip.significance.toFixed(1)}</span>
                                    </div>
                                </div>

                                {/* Content Section */}
                                <div className="p-4">
                                    <h4 className="font-semibold text-gray-900 mb-2 line-clamp-2">{clip.title}</h4>
                                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">{clip.description}</p>
                                    
                                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
                                        <Clock className="w-3 h-3" />
                                        <span>{Math.round(clip.start_time)}s - {Math.round(clip.end_time)}s</span>
                                        <span>•</span>
                                        <span className="capitalize">{clip.narrative_role}</span>
                                    </div>
                                    
                                    {/* Action Buttons */}
                                    <div className="space-y-2">
                                        <button
                                            onClick={() => handleDownload(clip)}
                                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white text-sm font-medium rounded-lg transition-all duration-300"
                                        >
                                            <Download className="w-4 h-4" />
                                            Download Clip
                                        </button>
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => handleEdit(clip)}
                                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white text-sm font-medium rounded-lg transition-all duration-300"
                                            >
                                                <Edit className="w-4 h-4" />
                                                Edit
                                            </button>
                                            <button 
                                                onClick={() => handlePreview(clip)}
                                                className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-all duration-300"
                                            >
                                                <Play className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    )
} 