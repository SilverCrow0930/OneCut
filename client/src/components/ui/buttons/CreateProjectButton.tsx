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
                flex items-center 
                gap-2 px-5 py-3 rounded-lg shadow-md
                bg-white text-black
                transform transition-all duration-300 ease-in-out
                ${loading ? 'opacity-80 scale-95' : 'hover:opacity-90 hover:scale-105'}
                active:scale-95
            `}
            onClick={handleCreateProject}
            disabled={loading}
        >
            <div className="relative w-5 h-5">
                {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                    <PlusIcon className="w-5 h-5 transition-transform duration-300 group-hover:rotate-90" />
                )}
            </div>
            <span className="font-medium">
                {loading ? 'Creating...' : 'Create a new project'}
            </span>
        </button>
    )
}

export default CreateProjectButton