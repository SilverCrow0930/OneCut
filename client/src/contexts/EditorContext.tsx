'use client'

import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    ReactNode,
    useReducer,
    useCallback,
} from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { apiPath } from '@/lib/config'
import { Project } from '@/types/projects'
import { useParams } from 'next/navigation'
import { initialHistory } from '@/lib/constants'
import { dbToClip, dbToTrack, historyReducer } from '@/lib/editor/utils'
import { Track, Clip, Command, SaveState } from '@/types/editor'
import { toDbClip, toDbTrack } from '../lib/editor/mapToDb'
import { generateAndUpdateProjectThumbnail } from '@/lib/thumbnailGenerator'

interface EditorContextType {
    project: Project | null
    loading: boolean
    error: string | null
    selectedTool: string | null
    setSelectedTool: (tool: string) => void
    refetch: () => void
    updateProjectName: (name: string) => Promise<void>
    updateProjectThumbnail: (thumbnailUrl: string) => Promise<void>
    generateThumbnail: () => Promise<void>

    // timeline
    tracks: Track[]
    clips: Clip[]
    loadingTimeline: boolean
    timelineError: string | null

    // history & commands
    executeCommand: (cmd: Command) => void
    updateCaptionTrackPlacement: (trackId: string, newPlacement: string) => void

    // undo/redo
    undo: () => void
    redo: () => void
    canUndo: boolean
    canRedo: boolean

    // save state
    saveState: SaveState

    // selection
    selectedClipId: string | null
    setSelectedClipId: (id: string | null) => void
    selectedClipIds: string[]
    setSelectedClipIds: (ids: string[]) => void
    selectedTrackId: string | null
    setSelectedTrackId: (id: string | null) => void
}

const EditorContext = createContext<EditorContextType | undefined>(undefined)

export function useEditor() {
    const context = useContext(EditorContext)
    if (!context) {
        throw new Error('useEditor must be inside EditorProvider')
    }
    return context
}


export function EditorProvider({ children }: { children: ReactNode }) {
    const { projectId } = useParams<{ projectId: string }>()
    const { session } = useAuth()

    // 1) Project metadata
    const [project, setProject] = useState<Project | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchProject = async () => {
        if (!session?.access_token) return

        // Don't reload if we already have the project data
        if (project && !error) return

        setLoading(true)
        setError(null)

        try {
            const response = await fetch(apiPath(`projects/${projectId}`), {
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json'
                },
            })

            if (!response.ok) {
                const text = await response.text()
                throw new Error(text || response.statusText)
            }

            const data: Project = await response.json()

            setProject(data)
        }
        catch (error: any) {
            setError(error.message)
        }
        finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        // Only fetch if we don't have the project data
        if (!project) {
            fetchProject()
        }
    }, [session?.access_token, projectId]) // Only depend on access_token instead of entire session

    // 2) Selected tool
    const [selectedTool, setSelectedTool] = useState<string | null>('Upload')

    // 3) History + Timeline
    const [history, dispatch] = useReducer(historyReducer, initialHistory)
    const { past, present, future } = history
    const { tracks, clips } = present

    const [loadingTimeline, setLoadingTimeline] = useState(true)
    const [timelineError, setTimelineError] = useState<string | null>(null)

    // 4) Save state
    const [saveState, setSaveState] = useState<SaveState>('saved')

    // selection
    const [selectedClipId, setSelectedClipId] = useState<string | null>(null)
    const [selectedClipIds, setSelectedClipIds] = useState<string[]>([])
    const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null)

    // Safety wrapper for setSelectedClipIds to handle edge cases
    const safeSetSelectedClipIds = useCallback((ids: string[]) => {
        setSelectedClipIds(ids || [])
    }, [])

    // Safety wrapper for setSelectedClipId to handle edge cases  
    const safeSetSelectedClipId = useCallback((id: string | null) => {
        setSelectedClipId(id)
    }, [])

    const fetchTimeline = async () => {
        if (!session?.access_token) return

        setLoadingTimeline(true);
        setTimelineError(null)

        try {
            const response = await fetch(apiPath(`timeline/${projectId}`),
                {
                    headers: {
                        Authorization: `Bearer ${session.access_token}`,
                    }
                })

            if (!response.ok) {
                const text = await response.text()
                throw new Error(text || response.statusText)
            }

            const payload: { tracks: Track[]; clips: Clip[] } = await response.json()

            dispatch({
                type: 'RESET',
                tracks: payload.tracks.map(dbToTrack),
                clips: payload.clips.map(dbToClip),
            })
        }
        catch (e: any) {
            setTimelineError(e.message)
        }
        finally {
            setLoadingTimeline(false)
        }
    }

    useEffect(() => {
        if (projectId) {
            fetchTimeline()
        }
    }, [session?.access_token, projectId])

    // Function to update all captions in a track to the same placement
    const updateCaptionTrackPlacement = (trackId: string, newPlacement: string) => {
        const captionClipsInTrack = clips.filter(clip => 
            clip.trackId === trackId && 
            clip.type === 'caption' &&
            clip.properties?.placement !== newPlacement
        )

        if (captionClipsInTrack.length === 0) return

        const commands = captionClipsInTrack.map(clip => ({
            type: 'UPDATE_CLIP' as const,
            payload: {
                before: clip,
                after: {
                    ...clip,
                    properties: {
                        ...clip.properties,
                        placement: newPlacement
                    }
                }
            }
        }))

        executeCommand({
            type: 'BATCH',
            payload: { commands }
        })
    }

    // 3) Command helpers
    const executeCommand = (cmd: Command) => {
        console.log('▶️ executeCommand', cmd)

        dispatch({
            type: 'EXECUTE',
            cmd
        })

        setSaveState('unsaved') // pending edits

        // Auto-generate thumbnail when video clips are added
        if (cmd.type === 'ADD_CLIP' && cmd.payload?.clip?.type === 'video' && cmd.payload?.clip?.assetId) {
            console.log('🎬 Video clip added, scheduling thumbnail generation...')
            
            // Schedule thumbnail generation after a short delay
            setTimeout(() => {
                if (session?.access_token && projectId && project && !project.thumbnail_url) {
                    console.log('🎬 Generating thumbnail after video clip addition...')
                    generateThumbnail()
                }
            }, 3000) // Wait 3 seconds for the clip to be properly added and saved
        }
    }
    const undo = () => dispatch({ type: 'UNDO' })
    const redo = () => dispatch({ type: 'REDO' })

    // 4) Auto-save full snapshot after edits
    useEffect(() => {
        // only once you have at least one command…
        if (past.length === 0) return;

        // …and you're in the "unsaved" state
        if (saveState !== 'unsaved') return;

        // flip into "saving"
        setSaveState('saving');
        console.log('🔄 [AutoSave] scheduling PUT…')

        const timer = setTimeout(async () => {
            console.log(`🔄 [AutoSave] PUT /timeline/${projectId}`)
            try {
                const res = await fetch(apiPath(`timeline/${projectId}`), {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${session?.access_token}`,
                    },
                    body: JSON.stringify({
                        // convert to snake_case rows for the DB
                        tracks: tracks.map(t => toDbTrack(t, projectId!)),
                        clips: clips.map(c => toDbClip(c)),
                    }),
                });

                console.log('📬 [AutoSave] response status:', res.status);

                if (!res.ok) {
                    const err = await res.text();
                    throw new Error(err || res.statusText);
                }

                console.log('✅ [AutoSave] saved!')
                setSaveState('saved');
            }
            catch (e) {
                console.error('🚨 [AutoSave] failed:', e);
                setSaveState('error');
            }
        }, 500);

        return () => {
            clearTimeout(timer);
        }
    }, [past.length, tracks, clips, session, projectId]);

    const updateProjectName = async (name: string) => {
        if (!session?.access_token) return

        setLoading(true)
        setError(null)

        try {
            const response = await fetch(apiPath(`projects/${projectId}`), {
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name
                }),
            })

            if (!response.ok) {
                const text = await response.text()
                throw new Error(text || response.statusText)
            }

            const data: Project = await response.json()

            setProject(data)
        }
        catch (error: any) {
            setError(error.message)
        }
        finally {
            setLoading(false)
        }
    }

    const updateProjectThumbnail = async (thumbnailUrl: string) => {
        if (!session?.access_token) return

        try {
            const response = await fetch(apiPath(`projects/${projectId}`), {
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    thumbnail_url: thumbnailUrl
                }),
            })

            if (!response.ok) {
                const text = await response.text()
                throw new Error(text || response.statusText)
            }

            const data: Project = await response.json()
            setProject(data)
        }
        catch (error: any) {
            console.error('Failed to update project thumbnail:', error)
            throw error
        }
    }

    const generateThumbnail = async () => {
        if (!session?.access_token || !projectId) return

        try {
            await generateAndUpdateProjectThumbnail(
                projectId,
                clips,
                session.access_token,
                updateProjectThumbnail
            )
        }
        catch (error: any) {
            console.error('Failed to generate thumbnail:', error)
            setError('Failed to generate thumbnail')
        }
    }

    // Auto-generate thumbnail when clips change and we have video clips
    useEffect(() => {
        const hasVideoClips = clips.some(clip => clip.type === 'video' && clip.assetId)
        
        // Only generate if:
        // 1. We have video clips
        // 2. We have a session and project ID
        // 3. Project is loaded and doesn't have a thumbnail
        if (hasVideoClips && session?.access_token && projectId && project && !project.thumbnail_url) {
            console.log('🎬 Auto-generating thumbnail for project with video clips...')
            
            const timer = setTimeout(() => {
                generateThumbnail()
            }, 1500) // Wait 1.5 seconds after clips change
            
            return () => clearTimeout(timer)
        }
    }, [clips.length, session?.access_token, projectId, project?.thumbnail_url, project?.id])

    // Also trigger when project first loads if it has clips but no thumbnail
    useEffect(() => {
        if (project && !project.thumbnail_url && clips.length > 0 && session?.access_token) {
            const hasVideoClips = clips.some(clip => clip.type === 'video' && clip.assetId)
            if (hasVideoClips) {
                console.log('🎬 Project loaded with video clips but no thumbnail, generating...')
                
                const timer = setTimeout(() => {
                    generateThumbnail()
                }, 2000) // Wait 2 seconds for everything to be ready
                
                return () => clearTimeout(timer)
            }
        }
    }, [project?.id, project?.thumbnail_url, clips.length, session?.access_token])

    return (
        <EditorContext.Provider value={{
            project, loading, error,
            selectedTool, setSelectedTool,
            refetch: fetchProject,
            updateProjectName,
            updateProjectThumbnail,
            generateThumbnail,

            // timeline
            tracks, clips, loadingTimeline, timelineError,

            // history & commands
            executeCommand, 
            updateCaptionTrackPlacement,
            undo, redo,
            canUndo: past.length > 0, canRedo: future.length > 0,

            // save state
            saveState,

            // selection
            selectedClipId,
            setSelectedClipId: safeSetSelectedClipId,
            selectedClipIds: selectedClipIds || [],
            setSelectedClipIds: safeSetSelectedClipIds,
            selectedTrackId,
            setSelectedTrackId,
        }}>
            {children}
        </EditorContext.Provider>
    )
}
