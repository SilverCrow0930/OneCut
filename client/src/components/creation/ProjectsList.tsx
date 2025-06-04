import React, { useEffect, useState } from 'react'
import { apiPath } from '@/lib/config'
import { useAuth } from '@/contexts/AuthContext'
import { Project } from '@/types/projects'
import { formatSecondsAsTimestamp } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { Play, Clock, Calendar, Star, MoreVertical, Edit2, Trash2, Copy, Share2, Loader2, AlertCircle, Folder } from 'lucide-react'

export default function ProjectsList() {
    const router = useRouter()
    const { session } = useAuth()
    const [projects, setProjects] = useState<Project[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [hoveredProject, setHoveredProject] = useState<string | null>(null)

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

    if (!session) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] py-12 px-4 text-center">
                <div className="w-20 h-20 mb-6 text-white/60">
                    <AlertCircle className="w-full h-full" />
                </div>
                <h3 className="text-2xl font-semibold text-white mb-3">Authentication Required</h3>
                <p className="text-gray-300 max-w-md leading-relaxed">
                    Please sign in to access your projects and start creating amazing content.
                </p>
            </div>
        )
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] py-12 px-4 text-center">
                <div className="relative mb-8">
                    <div className="w-16 h-16 border-4 border-purple-600/30 border-t-purple-500 rounded-full animate-spin"></div>
                    <div className="absolute inset-0 w-16 h-16 border-4 border-blue-600/20 border-b-blue-500 rounded-full animate-spin animation-delay-75"></div>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Loading your projects</h3>
                <p className="text-gray-400">
                    Gathering your creative work...
                </p>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] py-12 px-4 text-center">
                <div className="w-20 h-20 mb-6 text-red-400">
                    <AlertCircle className="w-full h-full" />
                </div>
                <h3 className="text-2xl font-semibold text-white mb-3">Something went wrong</h3>
                <p className="text-gray-300 max-w-md mb-6">
                    {error}
                </p>
                <button 
                    onClick={() => window.location.reload()}
                    className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors duration-200"
                >
                    Try Again
                </button>
            </div>
        )
    }

    if (projects.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] py-12 px-4 text-center">
                <div className="relative mb-8">
                    <div className="w-24 h-24 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-3xl flex items-center justify-center border border-white/20">
                        <Folder className="w-12 h-12 text-white/60" />
                    </div>
                    <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
                        <Star className="w-4 h-4 text-white" />
                    </div>
                </div>
                <h3 className="text-3xl font-bold text-white mb-4">Your creative journey starts here</h3>
                <p className="text-gray-300 max-w-lg leading-relaxed mb-8">
                    Ready to bring your ideas to life? Create your first project and discover the power of visual storytelling.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                    <button className="px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg">
                        Create Your First Project
                    </button>
                    <button className="px-8 py-4 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl font-semibold transition-all duration-300">
                        Explore Templates
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Projects Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                {projects.map((project, index) => (
                    <div
                        key={project.id}
                        className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm border border-white/20 hover:border-white/40 transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl cursor-pointer"
                        onClick={() => router.push(`/projects/${project.id}`)}
                        onMouseEnter={() => setHoveredProject(project.id)}
                        onMouseLeave={() => setHoveredProject(null)}
                        style={{ 
                            animationDelay: `${index * 100}ms`,
                            animation: 'fadeInUp 0.6s ease-out forwards'
                        }}
                    >
                        {/* Thumbnail Section */}
                        <div className="relative aspect-video overflow-hidden">
                            {project.thumbnail_url ? (
                                <img
                                    src={project.thumbnail_url}
                                    alt={project.name}
                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                    onError={(e) => {
                                        const target = e.currentTarget;
                                        target.style.display = 'none';
                                        const fallback = target.parentElement?.querySelector('.fallback-bg');
                                        if (fallback) {
                                            (fallback as HTMLElement).style.display = 'flex';
                                        }
                                    }}
                                />
                            ) : null}
                            
                            {/* Enhanced fallback background */}
                            <div 
                                className={`fallback-bg w-full h-full bg-gradient-to-br from-purple-600/30 via-blue-600/30 to-pink-600/30 flex flex-col items-center justify-center ${project.thumbnail_url ? 'hidden' : 'flex'}`}
                            >
                                <div className="p-4 bg-white/10 rounded-2xl mb-3 backdrop-blur-sm">
                                    <Play className="w-8 h-8 text-white/80" />
                                </div>
                                <span className="text-sm text-white/60 font-medium">No Preview</span>
                            </div>

                            {/* Overlay with play button */}
                            <div className={`absolute inset-0 bg-black/60 flex items-center justify-center transition-opacity duration-300 ${hoveredProject === project.id ? 'opacity-100' : 'opacity-0'}`}>
                                <div className="p-4 bg-white/20 rounded-full backdrop-blur-sm border border-white/30 transform transition-transform duration-300 hover:scale-110">
                                    <Play className="w-8 h-8 text-white fill-white" />
                                </div>
                            </div>

                            {/* Duration badge */}
                            {project.duration && project.duration > 0 && (
                                <div className="absolute top-3 right-3">
                                    <div className="flex items-center gap-1 px-2 py-1 bg-black/70 backdrop-blur-sm rounded-lg border border-white/20">
                                        <Clock className="w-3 h-3 text-white/80" />
                                        <span className="text-xs font-medium text-white">
                                            {formatSecondsAsTimestamp(project.duration)}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Action buttons */}
                            <div className={`absolute top-3 left-3 flex gap-2 transition-opacity duration-300 ${hoveredProject === project.id ? 'opacity-100' : 'opacity-0'}`}>
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        // Handle favorite toggle
                                    }}
                                    className="p-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg border border-white/30 transition-colors duration-200"
                                >
                                    <Star className="w-4 h-4 text-white" />
                                </button>
                            </div>
                        </div>

                        {/* Content Section */}
                        <div className="p-4 space-y-3">
                            <div className="flex items-start gap-3">
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-white text-lg leading-tight line-clamp-2 mb-1">
                                        {project.name || 'Untitled Project'}
                                    </h3>
                                    <div className="flex items-center gap-2 text-gray-400 text-sm">
                                        <Calendar className="w-3 h-3" />
                                        <span>
                                            {new Date(project.created_at || '').toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                                
                                {/* More options */}
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        // Handle menu toggle
                                    }}
                                    className="p-1 hover:bg-white/20 rounded-lg transition-colors duration-200 opacity-0 group-hover:opacity-100"
                                >
                                    <MoreVertical className="w-4 h-4 text-gray-400" />
                                </button>
                            </div>

                            {/* Progress bar or status */}
                            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all duration-1000"
                                    style={{ width: '75%' }} // This could be dynamic based on project completion
                                />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

// Add CSS for animations
const styles = `
@keyframes fadeInUp {
    from {
        opacity: 0;
        transform: translateY(30px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.animation-delay-75 {
    animation-delay: 0.075s;
}
`

// Inject styles
if (typeof document !== 'undefined') {
    const styleSheet = document.createElement('style')
    styleSheet.textContent = styles
    document.head.appendChild(styleSheet)
}
