'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { apiPath } from '@/lib/config'
import { Project } from '@/types/projects'
import { Download, Play, ArrowLeft, Zap, Clock, Star, Share2, Eye, Edit3, DownloadCloud } from 'lucide-react'

interface QuickClip {
    id: string
    title: string
    duration: number
    start_time: number
    end_time: number
    viral_score: number
    description: string
    thumbnail: string
    downloadUrl: string
    previewUrl: string
}

export default function QuickClipsPage() {
    const { id } = useParams()
    const router = useRouter()
    const { session } = useAuth()
    const [project, setProject] = useState<Project | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!session?.access_token) {
            router.push('/auth')
            return
        }

        async function loadProject() {
            try {
                const response = await fetch(apiPath(`projects/${id}`), {
                    headers: {
                        'Authorization': `Bearer ${session?.access_token}`
                    }
                })

                if (!response.ok) {
                    throw new Error('Failed to load project')
                }

                const projectData: Project = await response.json()
                
                if (projectData.type !== 'quickclips') {
                    router.push(`/projects/${id}`)
                    return
                }

                if (projectData.processing_status !== 'completed') {
                    router.push('/creation')
                    return
                }

                setProject(projectData)
            } catch (error) {
                console.error('Error loading project:', error)
                setError(error instanceof Error ? error.message : 'Failed to load project')
            } finally {
                setLoading(false)
            }
        }

        loadProject()
    }, [id, session, router])

    const formatDuration = (seconds: number) => {
        if (seconds < 60) {
            return `${seconds}s`
        } else {
            const minutes = Math.floor(seconds / 60)
            const remainingSeconds = seconds % 60
            return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`
        }
    }

    const handleDownload = (clip: QuickClip) => {
        // Create a download link that forces file download
        const link = document.createElement('a')
        link.href = clip.downloadUrl
        link.download = `${clip.title.replace(/[^a-zA-Z0-9]/g, '_')}.mp4`
        link.target = '_blank'
        
        // Append to body, click, and remove
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        
        console.log('Downloaded clip:', clip.title)
    }

    const handlePreview = (clip: QuickClip) => {
        window.open(clip.previewUrl, '_blank')
    }

    const handleEdit = async (clip: QuickClip) => {
        // Create a new project for editing this specific clip
        try {
            const response = await fetch(apiPath('projects'), {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: `Edit - ${clip.title}`,
                    description: `Editing clip: ${clip.description}`
                })
            })

            if (!response.ok) {
                throw new Error('Failed to create editing project')
            }

            const newProject = await response.json()
            
            // Navigate to editor with the clip loaded
            router.push(`/projects/${newProject.id}?clipUrl=${encodeURIComponent(clip.downloadUrl)}`)
        } catch (error) {
            console.error('Failed to create editing project:', error)
            alert('Failed to open editor. Please try again.')
        }
    }

    const handleBulkDownload = () => {
        clips.forEach((clip, index) => {
            setTimeout(() => {
                const link = document.createElement('a')
                link.href = clip.downloadUrl
                link.download = `${clip.title.replace(/[^a-zA-Z0-9]/g, '_')}.mp4`
                link.target = '_blank'
                
                document.body.appendChild(link)
                link.click()
                document.body.removeChild(link)
            }, index * 1000) // Stagger downloads by 1 second to avoid browser limits
        })
        
        console.log('Started bulk download of', clips.length, 'clips')
    }

    const getViralScoreColor = (score: number) => {
        if (score >= 8) return 'text-green-600 bg-green-100'
        if (score >= 6) return 'text-yellow-600 bg-yellow-100'
        return 'text-red-600 bg-red-100'
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading your clips...</p>
                </div>
            </div>
        )
    }

    if (error || !project) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 mb-4 text-red-400 mx-auto">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Clips</h2>
                    <p className="text-gray-600 mb-4">{error || 'Project not found'}</p>
                    <button
                        onClick={() => router.push('/creation')}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                    >
                        Back to Projects
                    </button>
                </div>
            </div>
        )
    }

    const clips = project.quickclips_data?.clips || []

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push('/creation')}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-emerald-100 rounded-lg">
                                    <Zap className="w-5 h-5 text-emerald-600" />
                                </div>
                                <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
                                <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    <Zap className="w-3 h-3" />
                                    Ready
                                </div>
                            </div>
                            <div className="flex items-center gap-6 text-sm text-gray-600">
                                <div className="flex items-center gap-1">
                                    <Clock className="w-4 h-4" />
                                    <span>Generated {new Date(project.updated_at).toLocaleDateString()}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Star className="w-4 h-4" />
                                    <span>{clips.length} clips created</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Eye className="w-4 h-4" />
                                    <span>{project.quickclips_data?.contentType || 'Unknown'} content</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {clips.length === 0 ? (
                    <div className="text-center py-16">
                        <div className="w-16 h-16 mx-auto mb-4 text-gray-400">
                            <Zap className="w-full h-full" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">No clips generated</h3>
                        <p className="text-gray-600">There was an issue generating clips for this project.</p>
                    </div>
                ) : (
                    <>
                        {/* Stats */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                            <div className="bg-white rounded-xl p-6 border border-gray-200">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-100 rounded-lg">
                                        <Play className="w-5 h-5 text-blue-600" />
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-gray-900">{clips.length}</div>
                                        <div className="text-sm text-gray-600">Total Clips</div>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white rounded-xl p-6 border border-gray-200">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-green-100 rounded-lg">
                                        <Clock className="w-5 h-5 text-green-600" />
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-gray-900">
                                            {formatDuration(clips.reduce((total, clip) => total + clip.duration, 0))}
                                        </div>
                                        <div className="text-sm text-gray-600">Total Duration</div>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white rounded-xl p-6 border border-gray-200">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-yellow-100 rounded-lg">
                                        <Star className="w-5 h-5 text-yellow-600" />
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-gray-900">
                                            {(clips.reduce((total, clip) => total + clip.viral_score, 0) / clips.length).toFixed(1)}
                                        </div>
                                        <div className="text-sm text-gray-600">Avg. Viral Score</div>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white rounded-xl p-6 border border-gray-200">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-purple-100 rounded-lg">
                                        <Share2 className="w-5 h-5 text-purple-600" />
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-gray-900">
                                            {project.quickclips_data?.videoFormat === 'short_vertical' ? '9:16' : '16:9'}
                                        </div>
                                        <div className="text-sm text-gray-600">Format</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Clips Grid */}
                        <div>
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-semibold text-gray-900">Generated Clips</h2>
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={handleBulkDownload}
                                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                                    >
                                        <DownloadCloud className="w-4 h-4" />
                                        Download All
                                    </button>
                                    <div className="text-sm text-gray-600">
                                        Sorted by viral score
                                    </div>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {clips
                                    .sort((a, b) => b.viral_score - a.viral_score)
                                    .map((clip) => (
                                        <div key={clip.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
                                            {/* Thumbnail */}
                                            <div className="relative aspect-video bg-gray-100">
                                                <img
                                                    src={clip.thumbnail}
                                                    alt={clip.title}
                                                    className="w-full h-full object-cover"
                                                />
                                                <div className="absolute top-3 left-3 flex items-center gap-2">
                                                    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getViralScoreColor(clip.viral_score)}`}>
                                                        <Star className="w-3 h-3" />
                                                        <span>{clip.viral_score}</span>
                                                    </div>
                                                </div>
                                                <div className="absolute top-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded">
                                                    {formatDuration(clip.duration)}
                                                </div>
                                                <div className="absolute bottom-3 left-3 right-3">
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => handlePreview(clip)}
                                                            className="flex-1 flex items-center justify-center gap-1 px-2 py-2 bg-white/90 backdrop-blur-sm text-gray-900 text-xs rounded-lg hover:bg-white transition-colors"
                                                        >
                                                            <Play className="w-3 h-3" />
                                                            Preview
                                                        </button>
                                                        <button
                                                            onClick={() => handleEdit(clip)}
                                                            className="flex-1 flex items-center justify-center gap-1 px-2 py-2 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors"
                                                        >
                                                            <Edit3 className="w-3 h-3" />
                                                            Edit
                                                        </button>
                                                        <button
                                                            onClick={() => handleDownload(clip)}
                                                            className="flex-1 flex items-center justify-center gap-1 px-2 py-2 bg-emerald-600 text-white text-xs rounded-lg hover:bg-emerald-700 transition-colors"
                                                        >
                                                            <Download className="w-3 h-3" />
                                                            Download
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Content */}
                                            <div className="p-4">
                                                <h3 className="font-semibold text-gray-900 mb-2">{clip.title}</h3>
                                                <p className="text-sm text-gray-600 mb-3">{clip.description}</p>
                                                <div className="flex items-center justify-between text-xs text-gray-500">
                                                    <span>{Math.floor(clip.start_time / 60)}:{(clip.start_time % 60).toString().padStart(2, '0')} - {Math.floor(clip.end_time / 60)}:{(clip.end_time % 60).toString().padStart(2, '0')}</span>
                                                    <span>{formatDuration(clip.duration)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
} 