import React from 'react'
import CreateProjectButton from '../ui/buttons/CreateProjectButton'

const ProjectsHeader = () => {
    return (
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

            {/* Title and Storage Info */}
            <div className="flex flex-row gap-6">
                <h1 className="text-white text-3xl font-semibold">
                    Projects
                </h1>
                <div className="
                    flex items-center gap-2 px-2 py-1 rounded-lg shadow-md
                    text-xs text-gray-300 bg-gradient-to-r from-blue-500 to-indigo-600 
                ">
                    <span>Storage Used:</span>
                    <span>0.00 GB</span>
                    <span>/</span>
                    <span>1 GB</span>
                </div>
                <button className="
                    text-sm text-gray-500 underline underline-offset-4
                    hover:text-gray-300 transition-colors duration-500
                ">
                    Need more space ?
                </button>
            </div>

            {/* Create Project Button */}
            <CreateProjectButton />
        </div>
    )
}

export default ProjectsHeader