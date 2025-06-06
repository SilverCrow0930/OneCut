'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { apiPath } from '@/lib/config'
import { Project, QuickClip } from '@/types/projects'
import { ArrowLeft, Download, Share2, Play, Edit3, Clock, TrendingUp, ExternalLink, Loader2 } from 'lucide-react'
import HomeNavbar from '@/components/home/HomeNavbar'

export default function QuickClipsPage() {
    const params = useParams()
    const router = useRouter()
    const { session } = useAuth()
    const [project, setProject] = useState<Project | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const projectId = params.id as string

    useEffect(() => {
        if (!session?.access_token || !projectId) return

        async function loadProject() {
            try {
                const response = await fetch(apiPath(`projects/${projectId}`), {
                    headers: {
                        'Authorization': `Bearer ${session.access_token}`
                    }
                })

                if (!response.ok) {
                    throw new Error('Failed to load project')
                }

                const data = await response.json()
                setProject(data)
            } catch (error) {
                console.error('Error loading project:', error)
                setError(error instanceof Error ? error.message : 'Failed to load project')
            } finally {
                setLoading(false)
            }
        }

        loadProject()
    }, [session, projectId])

    const formatDuration = (seconds: number) => {
        const minutes = Math.floor(seconds / 60)
        const remainingSeconds = seconds % 60
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
    }

    const handleDownloadClip = (clip: QuickClip) => {
        // In a real implementation, this would download the actual video file
        const link = document.createElement('a')
        link.href = clip.downloadUrl
        link.download = `${clip.title}.mp4`
        link.click()
    }

    const handleShareClip = async (clip: QuickClip) => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: clip.title,
                    text: clip.description,
                    url: clip.previewUrl
                })
            } catch (error) {
                // User cancelled the share
            }
        } else {
            // Fallback: copy to clipboard
            await navigator.clipboard.writeText(clip.previewUrl)
            alert('Link copied to clipboard!')
        }
    }

    const handleDownloadAll = () => {
        if (!project?.quickclips_data?.clips) return
        
        // In a real implementation, this would create and download a zip file
        alert('Downloading all clips... (feature will be implemented)')
    }

    const handleGoToEditor = () => {
        router.push(`/projects/${projectId}`)
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50">
                <HomeNavbar />
                <div className="flex items-center justify-center h-96">
                    <div className="flex items-center gap-3">
                        <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                        <span className="text-gray-600">Loading your QuickClips...</span>
                    </div>
                </div>
            </div>
        )
    }

    if (error || !project) {
        return (
            <div className="min-h-screen bg-gray-50">
                <HomeNavbar />
                <div className="max-w-4xl mx-auto px-4 py-16">
                    <div className="text-center">
                        <h1 className="text-2xl font-bold text-gray-900 mb-4">Project Not Found</h1>
                        <p className="text-gray-600 mb-8">{error || 'The project you\'re looking for doesn\'t exist or you don\'t have access to it.'}</p>
                        <button
                            onClick={() => router.push('/creation')}
                            className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                        >
                            Back to Projects
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    const clips = project.quickclips_data?.clips || []

    return (
        <div className="min-h-screen bg-gray-50">
            <HomeNavbar />
            
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-4 mb-6">
                        <button
                            onClick={() => router.push('/creation')}
                            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div className="flex-1">
                            <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
                            <p className="text-gray-600 mt-1">
                                QuickClips • {clips.length} clips generated • 
                                {project.video_format === 'short_vertical' ? ' Vertical (9:16)' : ' Horizontal (16:9)'}
                            </p>
                        </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-4">
                        <button
                            onClick={handleDownloadAll}
                            className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                        >
                            <Download className="w-5 h-5" />
                            Download All Clips
                        </button>
                        <button
                            onClick={handleGoToEditor}
                            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            <Edit3 className="w-5 h-5" />
                            Open in Editor
                        </button>
                    </div>
                </div>

                {/* Clips Grid */}
                {clips.length > 0 ? (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {clips.map((clip, index) => (
                            <div key={clip.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                                {/* Thumbnail */}
                                <div className="aspect-video bg-gray-100 relative group">
                                    <img 
                                        src={clip.thumbnail} 
                                        alt={clip.title}
                                        className="w-full h-full object-cover"
                                    />
                                    
                                    {/* Play overlay */}
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <button
                                            onClick={() => window.open(clip.previewUrl, '_blank')}
                                            className="bg-white/90 hover:bg-white rounded-full p-4 transition-colors"
                                        >
                                            <Play className="w-6 h-6 text-gray-900" />
                                        </button>
                                    </div>

                                    {/* Viral score badge */}
                                    <div className="absolute top-3 left-3">
                                        <div className="flex items-center gap-1 bg-black/70 text-white px-2 py-1 rounded-full text-xs font-medium">
                                            <TrendingUp className="w-3 h-3" />
                                            {clip.viral_score}/10
                                        </div>
                                    </div>

                                    {/* Duration badge */}
                                    <div className="absolute bottom-3 right-3">
                                        <div className="flex items-center gap-1 bg-black/70 text-white px-2 py-1 rounded-full text-xs font-medium">
                                            <Clock className="w-3 h-3" />
                                            {formatDuration(clip.duration)}
                                        </div>
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="p-6">
                                    <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">
                                        {clip.title}
                                    </h3>
                                    <p className="text-sm text-gray-600 mb-4 line-clamp-3">
                                        {clip.description}
                                    </p>

                                    {/* Timestamp */}
                                    <p className="text-xs text-gray-500 mb-4">
                                        {formatDuration(clip.start_time)} - {formatDuration(clip.end_time)}
                                    </p>

                                    {/* Actions */}
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => window.open(clip.previewUrl, '_blank')}
                                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-sm"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                            Preview
                                        </button>
                                        <button
                                            onClick={() => handleDownloadClip(clip)}
                                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors text-sm"
                                        >
                                            <Download className="w-4 h-4" />
                                            Download
                                        </button>
                                        <button
                                            onClick={() => handleShareClip(clip)}
                                            className="px-4 py-2 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                                        >
                                            <Share2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-16">
                        <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Play className="w-12 h-12 text-gray-400" />
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">No clips generated yet</h3>
                        <p className="text-gray-600 max-w-md mx-auto">
                            It looks like the AI processing hasn't completed yet or encountered an error. 
                            Please check back in a few minutes.
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
} 