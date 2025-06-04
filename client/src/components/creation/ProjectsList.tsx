import React, { useEffect, useState } from 'react'
import { apiPath } from '@/lib/config'
import { useAuth } from '@/contexts/AuthContext'
import { Project } from '@/types/projects'
import { formatSecondsAsTimestamp } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { Play, Clock, Calendar, Video, FolderOpen, Plus } from 'lucide-react'

export default function ProjectsList() {
    const router = useRouter()
    const { session } = useAuth()
    const [projects, setProjects] = useState<Project[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

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

    const formatDate = (dateString: string) => {
        const date = new Date(dateString)
        const now = new Date()
        const diffTime = Math.abs(now.getTime() - date.getTime())
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        
        if (diffDays === 1) return 'Yesterday'
        if (diffDays < 7) return `${diffDays} days ago`
        if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`
        if (diffDays < 365) return `${Math.ceil(diffDays / 30)} months ago`
        return date.toLocaleDateString()
    }

    if (!session) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] py-12 px-4 text-center">
                <div className="w-16 h-16 mb-6 p-4 bg-white/10 rounded-full backdrop-blur-sm">
                    <FolderOpen className="w-full h-full text-white/60" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Sign In Required</h3>
                <p className="text-gray-400 max-w-sm">
                    Please sign in to view and manage your projects.
                </p>
            </div>
        )
    }
    
    if (loading) {
        return (
            <div className="w-full">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-12">
                    {Array.from({ length: 8 }).map((_, index) => (
                        <div key={index} className="animate-pulse">
                            <div className="bg-white/10 rounded-xl h-48 mb-4"></div>
                            <div className="space-y-2">
                                <div className="h-4 bg-white/10 rounded w-3/4"></div>
                                <div className="h-3 bg-white/10 rounded w-1/2"></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )
    }
    
    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] py-12 px-4 text-center">
                <div className="w-16 h-16 mb-6 p-4 bg-red-500/20 rounded-full">
                    <Video className="w-full h-full text-red-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Error Loading Projects</h3>
                <p className="text-red-400 max-w-sm mb-4">{error}</p>
                <button 
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
                >
                    Try Again
                </button>
            </div>
        )
    }
    
    if (projects.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] py-12 px-4 text-center">
                <div className="w-20 h-20 mb-6 p-5 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-2xl backdrop-blur-sm border border-white/10">
                    <Plus className="w-full h-full text-white/60" />
                </div>
                <h3 className="text-2xl font-semibold text-white mb-3">Ready to Create?</h3>
                <p className="text-gray-400 max-w-md mb-6 leading-relaxed">
                    Start your creative journey by creating your first project. Bring your ideas to life with our powerful video editing tools.
                </p>
                <button 
                    onClick={() => router.push('/projects/new')}
                    className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-xl text-white font-medium transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                    Create Your First Project
                </button>
            </div>
        )
    }

    return (
        <div className="w-full">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-12">
                {projects.map((project, index) => (
                    <div
                        key={index}
                        className="
                            group
                            relative
                            bg-white/5 backdrop-blur-sm
                            rounded-2xl overflow-hidden
                            border border-white/10 hover:border-white/20
                            transition-all duration-300
                            cursor-pointer
                            hover:transform hover:-translate-y-2 hover:shadow-2xl hover:shadow-blue-500/20
                        "
                        onClick={() => router.push(`/projects/${project.id}`)}
                    >
                        {/* Thumbnail Section */}
                        <div className="relative aspect-video w-full overflow-hidden">
                            {project.thumbnail_url ? (
                                <img
                                    src={project.thumbnail_url}
                                    alt={project.name}
                                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
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
                                className={`fallback-bg w-full h-full bg-gradient-to-br from-gray-700/50 to-gray-900/50 flex flex-col items-center justify-center ${project.thumbnail_url ? 'hidden' : 'flex'}`}
                            >
                                <div className="p-4 bg-white/10 rounded-2xl mb-3 backdrop-blur-sm">
                                    <Video className="w-8 h-8 text-white/60" />
                                </div>
                                <span className="text-sm text-white/40 font-medium">No Preview</span>
                            </div>

                            {/* Overlay gradient */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                            {/* Play button overlay */}
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-95 group-hover:scale-100">
                                <div className="p-4 bg-white/20 backdrop-blur-sm rounded-full border border-white/30">
                                    <Play className="w-6 h-6 text-white fill-current" />
                                </div>
                            </div>

                            {/* Duration badge */}
                            {project.duration && project.duration > 0 && (
                                <div className="absolute top-3 right-3">
                                    <div className="flex items-center gap-1 px-2 py-1 bg-black/70 backdrop-blur-sm rounded-lg">
                                        <Clock className="w-3 h-3 text-white/80" />
                                        <span className="text-xs font-medium text-white">
                                            {formatSecondsAsTimestamp(project.duration)}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Content Section */}
                        <div className="p-5">
                            {/* Project Name */}
                            <h3 className="text-lg font-semibold text-white mb-2 line-clamp-2 leading-tight group-hover:text-blue-300 transition-colors">
                                {project.name || `Untitled Project`}
                            </h3>

                            {/* Project Info */}
                            <div className="flex items-center justify-between text-sm text-white/60">
                                <div className="flex items-center gap-1">
                                    <Calendar className="w-4 h-4" />
                                    <span>{formatDate(project.created_at)}</span>
                                </div>
                                {project.updated_at && project.updated_at !== project.created_at && (
                                    <span className="text-xs text-white/40">
                                        Updated {formatDate(project.updated_at)}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Hover glow effect */}
                        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                    </div>
                ))}
            </div>
        </div>
    )
}
