import React from 'react'
import { Sparkles, Folder, Zap } from 'lucide-react'
import CreateProjectButton from '../ui/buttons/CreateProjectButton'

const ProjectsHeader = () => {
    return (
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-8">
            {/* Title Section */}
            <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-xl border border-white/20">
                        <Folder className="w-6 h-6 text-white" />
                    </div>
                    <h1 className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-white via-purple-200 to-blue-200 bg-clip-text text-transparent">
                        Your Projects
                    </h1>
                    <Sparkles className="w-6 h-6 text-purple-400 animate-pulse" />
                </div>
                <p className="text-gray-300 text-lg leading-relaxed max-w-md">
                    Manage, edit, and bring your creative visions to life
                </p>
            </div>

            {/* Action Section */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                <CreateProjectButton />
                
                {/* Quick Actions */}
                <div className="flex gap-2">
                    <button className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl font-medium transition-all duration-300 text-sm">
                        Templates
                    </button>
                    <button className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl font-medium transition-all duration-300 text-sm">
                        Import
                    </button>
                </div>
            </div>
        </div>
    )
}

export default ProjectsHeader