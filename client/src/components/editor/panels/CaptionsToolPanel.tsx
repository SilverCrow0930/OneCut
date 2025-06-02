import React, { useState, useEffect } from 'react'
import { Wand2, Loader2, Clock, Trash2, Edit3, Check, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useEditor } from '@/contexts/EditorContext'
import { apiPath } from '@/lib/config'
import { Caption, CaptionGenerationResponse } from '@/types/captions'

const CaptionsToolPanel = () => {
    const { session } = useAuth()
    const { project } = useEditor()
    const projectId = project?.id

    const [captions, setCaptions] = useState<Caption[]>([])
    const [loading, setLoading] = useState(false)
    const [generating, setGenerating] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editText, setEditText] = useState('')

    // Load existing captions
    const loadCaptions = async () => {
        if (!session?.access_token || !projectId) return

        try {
            setLoading(true)
            setError(null)
            
            const url = apiPath(`captions/${projectId}`)
            console.log('Loading captions from:', url)
            
            const response = await fetch(url, {
                headers: {
                    Authorization: `Bearer ${session.access_token}`
                }
            })

            console.log('Response status:', response.status)
            console.log('Response headers:', Object.fromEntries(response.headers.entries()))

            if (!response.ok) {
                const text = await response.text()
                console.error('Failed to load captions - Response text:', text)
                throw new Error(`Failed to load captions: ${response.status} ${response.statusText}`)
            }

            const data = await response.json()
            console.log('Loaded captions:', data)
            setCaptions(data)
        } catch (err) {
            console.error('Failed to load captions:', err)
            setError(err instanceof Error ? err.message : 'Failed to load captions')
        } finally {
            setLoading(false)
        }
    }

    // Generate AI captions
    const generateCaptions = async () => {
        if (!session?.access_token || !projectId) {
            setError('Missing authentication or project ID')
            return
        }

        try {
            setGenerating(true)
            setError(null)
            
            const url = apiPath(`captions/${projectId}/generate`)
            console.log('Generating captions at:', url)
            
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json'
                }
            })

            console.log('Generate response status:', response.status)
            console.log('Generate response headers:', Object.fromEntries(response.headers.entries()))

            if (!response.ok) {
                const text = await response.text()
                console.error('Failed to generate captions - Response text:', text)
                
                try {
                    const errorData = JSON.parse(text)
                    throw new Error(errorData.error || 'Failed to generate captions')
                } catch (parseError) {
                    throw new Error(`Server error: ${response.status} ${response.statusText}. Response: ${text.substring(0, 200)}...`)
                }
            }

            const data: CaptionGenerationResponse = await response.json()
            console.log('Generated captions:', data)
            setCaptions(data.captions)
            
            // Show success message briefly
            setTimeout(() => setError(null), 3000)
            setError(`✅ ${data.message}`)
            
        } catch (err) {
            console.error('Failed to generate captions:', err)
            setError(err instanceof Error ? err.message : 'Failed to generate captions')
        } finally {
            setGenerating(false)
        }
    }

    // Update caption
    const updateCaption = async (id: string, text: string) => {
        if (!session?.access_token) return

        try {
            const caption = captions.find(c => c.id === id)
            if (!caption) return

            const response = await fetch(apiPath(`captions/${id}`), {
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text,
                    start_ms: caption.start_ms,
                    end_ms: caption.end_ms
                })
            })

            if (!response.ok) {
                const text = await response.text()
                throw new Error(`Failed to update caption: ${text}`)
            }

            const updatedCaption = await response.json()
            setCaptions(prev => prev.map(c => c.id === id ? updatedCaption : c))
            setEditingId(null)
            setEditText('')
        } catch (err) {
            console.error('Failed to update caption:', err)
            setError(err instanceof Error ? err.message : 'Failed to update caption')
        }
    }

    // Delete caption
    const deleteCaption = async (id: string) => {
        if (!session?.access_token) return

        try {
            const response = await fetch(apiPath(`captions/${id}`), {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${session.access_token}`
                }
            })

            if (!response.ok) {
                const text = await response.text()
                throw new Error(`Failed to delete caption: ${text}`)
            }

            setCaptions(prev => prev.filter(c => c.id !== id))
        } catch (err) {
            console.error('Failed to delete caption:', err)
            setError(err instanceof Error ? err.message : 'Failed to delete caption')
        }
    }

    // Start editing
    const startEditing = (caption: Caption) => {
        setEditingId(caption.id)
        setEditText(caption.text)
    }

    // Cancel editing
    const cancelEditing = () => {
        setEditingId(null)
        setEditText('')
    }

    // Save edit
    const saveEdit = () => {
        if (editingId && editText.trim()) {
            updateCaption(editingId, editText.trim())
        }
    }

    // Format time for display
    const formatTime = (ms: number) => {
        const seconds = Math.floor(ms / 1000)
        const minutes = Math.floor(seconds / 60)
        const remainingSeconds = seconds % 60
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
    }

    // Load captions on component mount
    useEffect(() => {
        if (projectId) {
            loadCaptions()
        }
    }, [projectId, session?.access_token])

    return (
        <div className="flex flex-col w-full gap-4 p-4 max-h-full overflow-hidden">
            <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-gray-800">Captions</h3>
                    <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 rounded-full">
                        <Wand2 className="w-3 h-3 text-blue-600" />
                        <span className="text-xs font-medium text-blue-600">AI</span>
                    </div>
                </div>
                <p className="text-sm text-gray-600">Generate AI-powered captions for your videos</p>
            </div>
            
            {/* Error Display */}
            {error && (
                <div className={`p-3 rounded-lg text-sm ${
                    error.startsWith('✅') 
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                    {error}
                </div>
            )}
            
            <div className="flex flex-col gap-4">
                {/* AI Caption Generation */}
                <div className="flex flex-col gap-3">
                    <h4 className="text-base font-medium text-gray-700">Auto-Generate Captions</h4>
                    <button 
                        onClick={generateCaptions}
                        disabled={generating || !projectId || !session?.access_token}
                        className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {generating ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Generating Captions...
                            </>
                        ) : (
                            <>
                                <Wand2 className="w-4 h-4" />
                                Generate Captions with AI
                            </>
                        )}
                    </button>
                    <p className="text-xs text-gray-500">
                        This will analyze your video's audio and create accurate, timed captions automatically.
                    </p>
                </div>

                {/* Caption List */}
                {captions.length > 0 && (
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <h4 className="text-base font-medium text-gray-700">Your Captions</h4>
                            <span className="text-xs text-gray-500">{captions.length} captions</span>
                        </div>
                        
                        <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                            {captions.map((caption) => (
                                <div key={caption.id} className="p-3 border border-gray-200 rounded-lg">
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <div className="flex items-center gap-2 text-xs text-gray-500">
                                            <Clock className="w-3 h-3" />
                                            <span>{formatTime(caption.start_ms)} - {formatTime(caption.end_ms)}</span>
                                            {caption.confidence && (
                                                <span className="px-1 py-0.5 bg-gray-100 rounded text-[10px]">
                                                    {Math.round(caption.confidence * 100)}%
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => startEditing(caption)}
                                                className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                            >
                                                <Edit3 className="w-3 h-3" />
                                            </button>
                                            <button
                                                onClick={() => deleteCaption(caption.id)}
                                                className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>
                                    
                                    {editingId === caption.id ? (
                                        <div className="flex flex-col gap-2">
                                            <textarea
                                                value={editText}
                                                onChange={(e) => setEditText(e.target.value)}
                                                className="w-full p-2 text-sm border border-gray-200 rounded resize-none focus:outline-none focus:border-blue-500"
                                                rows={2}
                                            />
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={saveEdit}
                                                    className="flex items-center gap-1 px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                                                >
                                                    <Check className="w-3 h-3" />
                                                    Save
                                                </button>
                                                <button
                                                    onClick={cancelEditing}
                                                    className="flex items-center gap-1 px-2 py-1 bg-gray-500 text-white rounded text-xs hover:bg-gray-600"
                                                >
                                                    <X className="w-3 h-3" />
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-gray-700">{caption.text}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Caption Settings */}
                <div className="flex flex-col gap-3">
                    <h4 className="text-base font-medium text-gray-700">Caption Style</h4>
                    <div className="grid grid-cols-2 gap-2">
                        <button className="px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm">
                            Bottom Center
                        </button>
                        <button className="px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm">
                            Top Center
                        </button>
                        <button className="px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm">
                            Custom Position
                        </button>
                        <button className="px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm">
                            Animated
                        </button>
                    </div>
                </div>

                {/* Font Options */}
                <div className="flex flex-col gap-3">
                    <h4 className="text-base font-medium text-gray-700">Font Style</h4>
                    <select className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500">
                        <option>Arial</option>
                        <option>Helvetica</option>
                        <option>Times New Roman</option>
                        <option>Roboto</option>
                    </select>
                </div>
            </div>
        </div>
    )
}

export default CaptionsToolPanel