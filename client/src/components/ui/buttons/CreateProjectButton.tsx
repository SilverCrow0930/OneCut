import React, { useState } from 'react'
import { Plus, Loader2, Sparkles, Zap } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { apiPath } from '@/lib/config'

const CreateProjectButton = () => {
    const { session } = useAuth()
    const router = useRouter()
    const [loading, setLoading] = useState(false)

    const handleCreateProject = async () => {
        if (!session?.access_token) return

        setLoading(true)
        try {
            const response = await fetch(apiPath('projects'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({}),
            })
            if (!response.ok) {
                const error = await response.text()
                throw new Error(`Error ${response.status}: ${error}`)
            }
            const data: { id: string } = await response.json()

            // Add a small delay to show the loading animation
            await new Promise(resolve => setTimeout(resolve, 500))

            router.push(`/projects/${data.id}`)
        }
        catch (error) {
            console.error(error)
        }
        finally {
            setLoading(false)
        }
    }

    return (
        <button
            className={`
                group relative overflow-hidden
                flex items-center justify-center gap-3 
                px-8 py-4 rounded-2xl 
                bg-gradient-to-r from-purple-600 via-blue-600 to-purple-600
                hover:from-purple-700 hover:via-blue-700 hover:to-purple-700
                text-white font-semibold text-lg
                shadow-lg hover:shadow-2xl hover:shadow-purple-500/25
                transform transition-all duration-500 ease-out
                ${loading ? 'opacity-90 scale-95' : 'hover:scale-105'}
                active:scale-95
                disabled:cursor-not-allowed
                min-w-[200px]
            `}
            onClick={handleCreateProject}
            disabled={loading}
        >
            {/* Animated background gradient */}
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            
            {/* Shimmer effect */}
            <div className="absolute inset-0 -top-2 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            
            {/* Button content */}
            <div className="relative flex items-center gap-3">
                <div className="relative">
                    {loading ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                        <div className="relative">
                            <Plus className="w-6 h-6 transition-transform duration-300 group-hover:rotate-90" />
                            <Sparkles className="absolute -top-1 -right-1 w-3 h-3 text-yellow-300 opacity-0 group-hover:opacity-100 animate-pulse transition-opacity duration-300" />
                        </div>
                    )}
                </div>
                <span className="relative">
                    {loading ? 'Creating Magic...' : 'Create New Project'}
                </span>
                {!loading && (
                    <Zap className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-all duration-300 transform group-hover:translate-x-1" />
                )}
            </div>
        </button>
    )
}

export default CreateProjectButton