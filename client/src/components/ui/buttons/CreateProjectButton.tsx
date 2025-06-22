import React, { useState } from 'react'
import { PlusIcon, Loader2 } from 'lucide-react'
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
                inline-flex items-center justify-center gap-2 
                px-6 py-3 rounded-lg font-semibold text-white
                bg-gradient-to-br from-emerald-400 to-green-600
                hover:from-emerald-500 hover:to-green-700
                focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2
                shadow-lg hover:shadow-xl
                transform transition-all duration-200
                ${loading ? 'opacity-80 cursor-not-allowed' : 'hover:scale-105 active:scale-95'}
            `}
            onClick={handleCreateProject}
            disabled={loading}
        >
            <div className="w-5 h-5">
                {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                    <PlusIcon className="w-5 h-5" />
                )}
            </div>
            <span>
                {loading ? 'Creating Project...' : 'Create New Project'}
            </span>
        </button>
    )
}

export default CreateProjectButton