'use client'

import { useState, useEffect } from 'react'
import { Search, Grid3X3, List, SortDesc, Filter, Sparkles, Zap, Folder, Clock, Calendar, Star, TrendingUp } from 'lucide-react'
import BubbleEffect from "@/components/ui/backgrounds/BubbleEffect"
import ProjectsList from "@/components/creation/ProjectsList"
import ProjectsHeader from "@/components/creation/ProjectsHeader"
import HomeNavbar from "@/components/home/HomeNavbar"
import { useAuth } from '@/contexts/AuthContext'

export default function CreatePage() {
    const [searchQuery, setSearchQuery] = useState('')
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
    const [sortBy, setSortBy] = useState<'recent' | 'name' | 'duration'>('recent')
    const [filterBy, setFilterBy] = useState<'all' | 'favorites' | 'recent'>('all')
    const [showFilters, setShowFilters] = useState(false)
    const { user } = useAuth()

    // Stats data (this could come from an API)
    const [stats, setStats] = useState({
        totalProjects: 0,
        totalDuration: 0,
        recentActivity: 0
    })

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
            {/* Enhanced Background with animated gradient */}
            <div className="absolute inset-0 overflow-hidden">
                <BubbleEffect />
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-pink-600/10 animate-pulse" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-900/20 via-slate-900/40 to-slate-900" />
            </div>

            {/* Enhanced Navbar */}
            <div className="relative z-10">
                <HomeNavbar />
            </div>

            {/* Main Content Container */}
            <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12">
                
                {/* Welcome Section */}
                <div className="mb-12 text-center">
                    <div className="flex items-center justify-center gap-2 mb-4">
                        <Sparkles className="w-8 h-8 text-purple-400 animate-pulse" />
                        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold bg-gradient-to-r from-white via-purple-200 to-blue-200 bg-clip-text text-transparent">
                            Create Magic
                        </h1>
                        <Zap className="w-8 h-8 text-blue-400 animate-bounce" />
                    </div>
                    <p className="text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed">
                        Transform your ideas into stunning visual stories. Every great creation starts here.
                    </p>
                </div>

                {/* Quick Stats Bar */}
                {user && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 hover:bg-white/15 transition-all duration-300">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-500/20 rounded-lg">
                                    <Folder className="w-5 h-5 text-blue-400" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-white">{stats.totalProjects}</p>
                                    <p className="text-sm text-gray-400">Total Projects</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 hover:bg-white/15 transition-all duration-300">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-purple-500/20 rounded-lg">
                                    <Clock className="w-5 h-5 text-purple-400" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-white">{Math.round(stats.totalDuration / 60)}m</p>
                                    <p className="text-sm text-gray-400">Content Created</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 hover:bg-white/15 transition-all duration-300">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-green-500/20 rounded-lg">
                                    <TrendingUp className="w-5 h-5 text-green-400" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-white">{stats.recentActivity}</p>
                                    <p className="text-sm text-gray-400">This Week</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Enhanced Projects Header with Search and Controls */}
                <div className="mb-8">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-6">
                        <ProjectsHeader />
                    </div>
                    
                    {/* Search and Filter Controls */}
                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
                        <div className="flex flex-col sm:flex-row gap-4 items-center">
                            {/* Search Bar */}
                            <div className="relative flex-1 max-w-md">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search your projects..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300"
                                />
                            </div>

                            {/* View Mode Toggle */}
                            <div className="flex bg-white/10 rounded-xl p-1 border border-white/20">
                                <button
                                    onClick={() => setViewMode('grid')}
                                    className={`p-2 rounded-lg transition-all duration-200 ${
                                        viewMode === 'grid' 
                                            ? 'bg-white/20 text-white shadow-lg' 
                                            : 'text-gray-400 hover:text-white hover:bg-white/10'
                                    }`}
                                >
                                    <Grid3X3 className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => setViewMode('list')}
                                    className={`p-2 rounded-lg transition-all duration-200 ${
                                        viewMode === 'list' 
                                            ? 'bg-white/20 text-white shadow-lg' 
                                            : 'text-gray-400 hover:text-white hover:bg-white/10'
                                    }`}
                                >
                                    <List className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Sort Dropdown */}
                            <div className="relative">
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value as any)}
                                    className="appearance-none bg-white/10 border border-white/20 rounded-xl px-4 py-3 pr-8 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent cursor-pointer"
                                >
                                    <option value="recent" className="bg-slate-800">Recently Modified</option>
                                    <option value="name" className="bg-slate-800">Name</option>
                                    <option value="duration" className="bg-slate-800">Duration</option>
                                </select>
                                <SortDesc className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            </div>

                            {/* Filter Dropdown */}
                            <div className="relative">
                                <select
                                    value={filterBy}
                                    onChange={(e) => setFilterBy(e.target.value as any)}
                                    className="appearance-none bg-white/10 border border-white/20 rounded-xl px-4 py-3 pr-8 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent cursor-pointer"
                                >
                                    <option value="all" className="bg-slate-800">All Projects</option>
                                    <option value="favorites" className="bg-slate-800">Favorites</option>
                                    <option value="recent" className="bg-slate-800">Recent</option>
                                </select>
                                <Filter className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Enhanced Projects List */}
                <div className="bg-white/5 backdrop-blur-sm rounded-3xl p-6 lg:p-8 border border-white/10 shadow-2xl">
                    <ProjectsList />
                </div>

                {/* Inspiration Section */}
                <div className="mt-16 text-center">
                    <h2 className="text-3xl font-bold text-white mb-4">Need Inspiration?</h2>
                    <p className="text-gray-300 mb-8 max-w-2xl mx-auto">
                        Explore trending templates and discover what others are creating in our community.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div className="bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-2xl p-6 border border-white/20 hover:scale-105 transition-transform duration-300 cursor-pointer">
                            <div className="w-12 h-12 bg-blue-500/30 rounded-xl flex items-center justify-center mb-4 mx-auto">
                                <Sparkles className="w-6 h-6 text-blue-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-white mb-2">AI Templates</h3>
                            <p className="text-gray-300 text-sm">Generate unique projects with AI assistance</p>
                        </div>
                        <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-2xl p-6 border border-white/20 hover:scale-105 transition-transform duration-300 cursor-pointer">
                            <div className="w-12 h-12 bg-purple-500/30 rounded-xl flex items-center justify-center mb-4 mx-auto">
                                <Star className="w-6 h-6 text-purple-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-white mb-2">Featured</h3>
                            <p className="text-gray-300 text-sm">Curated collection of popular projects</p>
                        </div>
                        <div className="bg-gradient-to-br from-green-500/20 to-teal-500/20 rounded-2xl p-6 border border-white/20 hover:scale-105 transition-transform duration-300 cursor-pointer">
                            <div className="w-12 h-12 bg-green-500/30 rounded-xl flex items-center justify-center mb-4 mx-auto">
                                <TrendingUp className="w-6 h-6 text-green-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-white mb-2">Trending</h3>
                            <p className="text-gray-300 text-sm">See what's popular in the community</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}