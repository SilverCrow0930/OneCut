'use client'

import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    ReactNode,
    useReducer,
} from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { apiPath } from '@/lib/config'
import { Project } from '@/types/projects'
import { useParams } from 'next/navigation'
import { initialHistory } from '@/lib/constants'
import { dbToClip, dbToTrack, historyReducer } from '@/lib/editor/utils'
import { Track, Clip, Command, SaveState } from '@/types/editor'
import { toDbClip, toDbTrack } from '../lib/editor/mapToDb'

interface EditorContextType {
    project: Project | null
    loading: boolean
    error: string | null
    selectedTool: string | null
    setSelectedTool: (tool: string) => void
    refetch: () => void

    // timeline
    tracks: Track[]
    clips: Clip[]
    loadingTimeline: boolean
    timelineError: string | null

    // history & commands
    executeCommand: (cmd: Command) => void

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
    const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null)

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

    // 3) Command helpers
    const executeCommand = (cmd: Command) => {
        console.log('▶️ executeCommand', cmd)

        dispatch({
            type: 'EXECUTE',
            cmd
        })

        setSaveState('unsaved') // pending edits
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

    return (
        <EditorContext.Provider value={{
            project, loading, error,
            selectedTool, setSelectedTool,
            refetch: fetchProject,

            // timeline
            tracks, clips, loadingTimeline, timelineError,

            // history & commands
            executeCommand, undo, redo,
            canUndo: past.length > 0, canRedo: future.length > 0,

            // save state
            saveState,

            // selection
            selectedClipId,
            setSelectedClipId,
            selectedTrackId,
            setSelectedTrackId,
        }}>
            {children}
        </EditorContext.Provider>
    )
}
