"use client"

import React from 'react'
import Menu from './Menu'
import { useAuth } from '@/contexts/AuthContext'
import { useProject } from '@/contexts/EditorContext'

const Editor = () => {
    const { session } = useAuth()
    const { project, loading, error } = useProject()

    // Render states
    if (!session) {
        return (
            <div className="flex items-center justify-center w-screen h-screen">
                <p>Please sign in...</p>
            </div>
        )
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center w-screen h-screen">
                <p>Loading project...</p>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex items-center justify-center w-screen h-screen">
                <p className="text-red-500">Error: {error}</p>
            </div>
        )
    }

    if (!project) {
        return (
            <div className="flex items-center justify-center w-screen h-screen">
                <p>Project not found.</p>
            </div>
        )
    }

    return (
        <div className="flex flex-col items-center justify-center w-screen h-screen bg-gray-100 p-4">
            <Menu />
            <div className="flex flex-col items-center justify-center w-full h-full bg-gray-300">
                <p>Editor</p>
            </div>
        </div>
    )
}

export default Editor