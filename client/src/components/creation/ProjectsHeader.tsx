import React from 'react'
import CreateProjectButton from '../ui/buttons/CreateProjectButton'

const ProjectsHeader = () => {
    return (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            {/* Title Section */}
            <div className="space-y-2">
                <h1 className="text-3xl font-bold text-gray-900">
                    Your Projects
                </h1>
                <p className="text-gray-600">
                    Create and manage your video projects
                </p>
            </div>

            {/* Create Project Button */}
            <div className="flex-shrink-0">
                <CreateProjectButton />
            </div>
        </div>
    )
}

export default ProjectsHeader