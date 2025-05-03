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
            router.push(`/edit/${data.id}`)
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
            className="
                flex items-center 
                gap-2 px-5 py-3 rounded-lg shadow-md
                bg-white text-black hover:opacity-60  
                duration-500
            "
            onClick={handleCreateProject}
            disabled={loading}
        >
            {
                loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                    <PlusIcon className="w-5 h-5" />
                )
            }
            <span className="font-medium">
                Create a New Project
            </span>
        </button>
    )
}

export default CreateProjectButton