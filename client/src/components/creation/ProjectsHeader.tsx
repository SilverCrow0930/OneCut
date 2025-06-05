import React from 'react'
import CreateProjectButton from '../ui/buttons/CreateProjectButton'

const ProjectsHeader = () => {
    return (
        <div className="flex flex-col items-center space-y-8">
            {/* Title Section - More prominent like Canva */}
            <div className="space-y-4">
                <h1 className="text-4xl md:text-5xl font-bold text-gray-900">
                    What will you create today?
                </h1>
                <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                    Transform your ideas into compelling videos with AI-powered editing tools
                </p>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-col sm:flex-row items-center gap-6">
                <CreateProjectButton />
                <p className="text-sm text-gray-500">
                    or browse your existing projects below
                </p>
            </div>
        </div>
    )
}

export default ProjectsHeader