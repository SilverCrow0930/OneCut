import React, { useRef, useState, useEffect } from 'react'
import { io, Socket } from 'socket.io-client'
import ChatHeader from '../assistant/ChatHeader'
import ChatHistory from '../assistant/ChatHistory'
import ChatTextField from '../assistant/ChatTextField'
import { API_URL } from '@/lib/config'
import { useAuth } from '@/contexts/AuthContext'
import { useEditor } from '@/contexts/EditorContext'
import { usePlayback } from '@/contexts/PlaybackContext'
import { useAssets } from '@/contexts/AssetsContext'
import { addAssetToTrack } from '@/lib/editor/utils'
import { v4 as uuid } from 'uuid'
import { Clip } from '@/types/editor'

interface ChatMessage {
    id: number;
    message: string;
    sender: 'user' | 'assistant';
    actions?: VideoAction[];
}

interface VideoAction {
    type: 'ADD_CLIP' | 'REMOVE_CLIP' | 'UPDATE_CLIP' | 'SPLIT_CLIP' | 'TRIM_CLIP' | 'ADD_TRANSITION' | 'ADJUST_SPEED' | 'AUTO_CUT' | 'SUGGESTION';
    description: string;
    data?: any;
}

interface TimelineGap {
    trackId: string;
    startMs: number;
    endMs: number;
    duration: number;
}

interface TimelineOverlap {
    clip1: Clip;
    clip2: Clip;
    overlapMs: number;
}

interface TimelineAnalysis {
    totalDuration: number;
    trackCount: number;
    clipCount: number;
    videoClips: number;
    audioClips: number;
    textClips: number;
    gaps: TimelineGap[];
    overlaps: TimelineOverlap[];
    speedIssues: Clip[];
    volumeIssues: Clip[];
}

const Assistant = () => {
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
    const [state, setState] = useState<string>('idle')
    const socketRef = useRef<Socket | null>(null)
    const [message, setMessage] = useState<string>("")
    const { session } = useAuth()
    
    // Video editing context
    const { 
        executeCommand, 
        tracks, 
        clips, 
        selectedClipId, 
        setSelectedClipId,
        selectedClipIds,
        setSelectedClipIds,
        project,
        undo,
        redo,
        canUndo,
        canRedo
    } = useEditor()
    
    const { currentTime, isPlaying, play, pause } = usePlayback()
    const { assets } = useAssets()

    // Video Agent Intelligence Functions
    const analyzeTimeline = (): TimelineAnalysis => {
        const analysis: TimelineAnalysis = {
            totalDuration: Math.max(...clips.map(c => c.timelineEndMs), 0),
            trackCount: tracks.length,
            clipCount: clips.length,
            videoClips: clips.filter(c => c.type === 'video').length,
            audioClips: clips.filter(c => c.type === 'audio').length,
            textClips: clips.filter(c => c.type === 'text' || c.type === 'caption').length,
            gaps: findGaps(),
            overlaps: findOverlaps(),
            speedIssues: findSpeedIssues(),
            volumeIssues: findVolumeIssues()
        }
        return analysis
    }

    const findGaps = (): TimelineGap[] => {
        const gaps: TimelineGap[] = []
        tracks.forEach(track => {
            const trackClips = clips.filter(c => c.trackId === track.id).sort((a, b) => a.timelineStartMs - b.timelineStartMs)
            for (let i = 0; i < trackClips.length - 1; i++) {
                const currentEnd = trackClips[i].timelineEndMs
                const nextStart = trackClips[i + 1].timelineStartMs
                if (nextStart > currentEnd) {
                    gaps.push({
                        trackId: track.id,
                        startMs: currentEnd,
                        endMs: nextStart,
                        duration: nextStart - currentEnd
                    })
                }
            }
        })
        return gaps
    }

    const findOverlaps = (): TimelineOverlap[] => {
        const overlaps: TimelineOverlap[] = []
        tracks.forEach(track => {
            const trackClips = clips.filter(c => c.trackId === track.id).sort((a, b) => a.timelineStartMs - b.timelineStartMs)
            for (let i = 0; i < trackClips.length - 1; i++) {
                const currentEnd = trackClips[i].timelineEndMs
                const nextStart = trackClips[i + 1].timelineStartMs
                if (nextStart < currentEnd) {
                    overlaps.push({
                        clip1: trackClips[i],
                        clip2: trackClips[i + 1],
                        overlapMs: currentEnd - nextStart
                    })
                }
            }
        })
        return overlaps
    }

    const findSpeedIssues = (): Clip[] => {
        return clips.filter(c => c.speed > 3 || c.speed < 0.5)
    }

    const findVolumeIssues = (): Clip[] => {
        return clips.filter(c => (c.type === 'audio' || c.type === 'video') && (c.volume > 1.5 || c.volume < 0.1))
    }

    // AI Video Agent Actions
    const executeVideoAction = (action: VideoAction) => {
        switch (action.type) {
            case 'ADD_CLIP':
                if (action.data.asset) {
                    addAssetToTrack(action.data.asset, tracks, clips, executeCommand, project?.id || '', action.data.options || {})
                }
                break

            case 'REMOVE_CLIP':
                if (action.data.clipId) {
                    const clipToRemove = clips.find(c => c.id === action.data.clipId)
                    if (clipToRemove) {
                        executeCommand({ type: 'REMOVE_CLIP', payload: { clip: clipToRemove } })
                    }
                }
                break

            case 'SPLIT_CLIP':
                if (action.data.clipId) {
                    const clipToSplit = clips.find(c => c.id === action.data.clipId)
                    const splitTime = action.data.splitTimeMs || currentTime * 1000
                    if (clipToSplit && splitTime > clipToSplit.timelineStartMs && splitTime < clipToSplit.timelineEndMs) {
                        const firstPart = {
                            ...clipToSplit,
                            timelineEndMs: splitTime,
                            sourceEndMs: clipToSplit.sourceStartMs + (splitTime - clipToSplit.timelineStartMs)
                        }
                        const secondPart = {
                            ...clipToSplit,
                            id: uuid(),
                            timelineStartMs: splitTime,
                            sourceStartMs: clipToSplit.sourceStartMs + (splitTime - clipToSplit.timelineStartMs)
                        }
                        executeCommand({
                            type: 'BATCH',
                            payload: {
                                commands: [
                                    { type: 'UPDATE_CLIP', payload: { before: clipToSplit, after: firstPart } },
                                    { type: 'ADD_CLIP', payload: { clip: secondPart } }
                                ]
                            }
                        })
                    }
                }
                break

            case 'ADJUST_SPEED':
                if (action.data.clipIds && action.data.speed) {
                    const clipsToUpdate = clips.filter(c => action.data.clipIds.includes(c.id))
                    const commands = clipsToUpdate.map(clip => {
                        const newTimelineDuration = Math.round((clip.sourceEndMs - clip.sourceStartMs) / action.data.speed)
                        return {
                            type: 'UPDATE_CLIP' as const,
                            payload: {
                                before: clip,
                                after: {
                                    ...clip,
                                    speed: action.data.speed,
                                    timelineEndMs: clip.timelineStartMs + newTimelineDuration
                                }
                            }
                        }
                    })
                    if (commands.length > 0) {
                        executeCommand({ type: 'BATCH', payload: { commands } })
                    }
                }
                break

            case 'TRIM_CLIP':
                if (action.data.clipId && (action.data.newStartMs !== undefined || action.data.newEndMs !== undefined)) {
                    const clipToTrim = clips.find(c => c.id === action.data.clipId)
                    if (clipToTrim) {
                        const updatedClip = {
                            ...clipToTrim,
                            timelineStartMs: action.data.newStartMs ?? clipToTrim.timelineStartMs,
                            timelineEndMs: action.data.newEndMs ?? clipToTrim.timelineEndMs
                        }
                        executeCommand({
                            type: 'UPDATE_CLIP',
                            payload: { before: clipToTrim, after: updatedClip }
                        })
                    }
                }
                break

            default:
                console.log('Unknown action type:', action.type)
        }
    }

    const generateProactiveSuggestions = () => {
        const analysis = analyzeTimeline()
        const suggestions = []

        if (analysis.gaps.length > 0) {
            suggestions.push({
                type: 'gap_detected',
                message: `I found ${analysis.gaps.length} gap(s) in your timeline. Would you like me to close them or add transitions?`,
                actions: analysis.gaps.map(gap => ({
                    type: 'SUGGESTION' as const,
                    description: `Close gap of ${(gap.duration / 1000).toFixed(1)}s on track`,
                    data: { gap }
                }))
            })
        }

        if (analysis.overlaps.length > 0) {
            suggestions.push({
                type: 'overlap_detected',
                message: `I detected ${analysis.overlaps.length} overlapping clip(s). This might cause audio/video issues.`,
                actions: analysis.overlaps.map(overlap => ({
                    type: 'SUGGESTION' as const,
                    description: `Fix overlap between clips`,
                    data: { overlap }
                }))
            })
        }

        if (analysis.speedIssues.length > 0) {
            suggestions.push({
                type: 'speed_issues',
                message: `${analysis.speedIssues.length} clips have extreme speed settings that might look unnatural.`,
                actions: analysis.speedIssues.map(clip => ({
                    type: 'ADJUST_SPEED' as const,
                    description: `Normalize speed for clip`,
                    data: { clipIds: [clip.id], speed: 1.0 }
                }))
            })
        }

        if (analysis.totalDuration < 10000) {
            suggestions.push({
                type: 'short_video',
                message: 'Your video is quite short. Would you like me to suggest ways to extend it or find related content?'
            })
        }

        return suggestions
    }

    // Enhanced message processing with video context
    const processMessageWithVideoContext = (userMessage: string): string => {
        const context = {
            timeline: analyzeTimeline(),
            currentTime: currentTime,
            selectedClip: selectedClipId ? clips.find(c => c.id === selectedClipId) : null,
            selectedClips: clips.filter(c => selectedClipIds.includes(c.id)),
            availableAssets: assets.length,
            projectDuration: Math.max(...clips.map(c => c.timelineEndMs), 0) / 1000,
            suggestions: generateProactiveSuggestions()
        }

        return `${userMessage}\n\n[VIDEO_CONTEXT: ${JSON.stringify(context)}]`
    }

    useEffect(() => {
        // Initialize socket connection with enhanced video agent capabilities
        socketRef.current = io(API_URL, {
            transports: ['websocket'],
            path: '/socket.io/',
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            randomizationFactor: 0.5,
            timeout: 60000,
            autoConnect: true,
            forceNew: true,
            upgrade: false,
            rememberUpgrade: false
        });

        // Connection event handlers
        socketRef.current.on('connect', () => {
            console.log('Video AI Agent connected successfully');
        });

        socketRef.current.on('connect_error', (error) => {
            console.error('Video AI Agent connection error:', error);
        });

        // Enhanced message handling with video actions
        socketRef.current.on('chat_message', (data: { text: string; actions?: VideoAction[] }) => {
            setChatMessages(prev => [...prev, {
                id: prev.length + 1,
                message: data.text,
                sender: 'assistant',
                actions: data.actions || []
            }])

            // Auto-execute safe actions if user preference is set
            if (data.actions) {
                data.actions.forEach(action => {
                    // Auto-execute suggestions and non-destructive actions
                    if (action.type === 'SUGGESTION') {
                        console.log('AI Suggestion:', action.description)
                    }
                })
            }
        })

        // Listen for state changes
        socketRef.current.on('state_change', (data: { state: string }) => {
            setState(data.state)
        })

        // Listen for video agent commands
        socketRef.current.on('video_action', (data: { action: VideoAction }) => {
            console.log('Executing video action:', data.action)
            executeVideoAction(data.action)
        })

        // Auto-send proactive suggestions on timeline changes
        const timelineChangeHandler = () => {
            if (clips.length > 0) {
                const suggestions = generateProactiveSuggestions()
                if (suggestions.length > 0) {
                    setTimeout(() => {
                        if (socketRef.current) {
                            socketRef.current.emit('timeline_analysis', { suggestions })
                        }
                    }, 2000) // Wait 2 seconds after changes to avoid spam
                }
            }
        }

        // Cleanup on unmount
        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect()
            }
        }
    }, [])

    // Monitor timeline changes for proactive assistance
    useEffect(() => {
        if (clips.length > 0) {
            const suggestions = generateProactiveSuggestions()
            if (suggestions.length > 0 && socketRef.current) {
                setTimeout(() => {
                    socketRef.current?.emit('timeline_analysis', { 
                        timeline: analyzeTimeline(),
                        suggestions 
                    })
                }, 1000)
            }
        }
    }, [clips.length, tracks.length])

    const handleSendMessage = (message: string, useIdeation: boolean) => {
        if (!socketRef.current) return

        // Add user message to chat
        setChatMessages(prev => [...prev, {
            id: prev.length + 1,
            message,
            sender: 'user'
        }])

        // Send enhanced message with video context
        const enhancedMessage = processMessageWithVideoContext(message)
        socketRef.current.emit('chat_message', { 
            message: enhancedMessage, 
            useIdeation,
            isVideoAgent: true,
            videoContext: {
                timeline: analyzeTimeline(),
                currentTime,
                selectedClipId,
                selectedClipIds,
                availableAssets: assets.map(a => ({ id: a.id, name: a.name, type: a.mime_type, duration: a.duration }))
            }
        })
    }

    const handleActionClick = (action: VideoAction) => {
        executeVideoAction(action)
        // Send feedback to AI
        if (socketRef.current) {
            socketRef.current.emit('action_executed', { action })
        }
    }

    return (
        <div className="
            flex flex-col items-center justify-between w-full h-full
            p-2
        ">
            {/* Video AI Agent Header */}
            <div className="w-full mb-2 p-2 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium text-blue-700">AI Video Agent</span>
                    <span className="text-xs text-blue-500">
                        {clips.length} clips • {tracks.length} tracks
                    </span>
                </div>
                {canUndo && (
                    <div className="flex gap-1 mt-1">
                        <button 
                            onClick={undo}
                            className="text-xs px-2 py-1 bg-blue-100 hover:bg-blue-200 rounded text-blue-700"
                        >
                            Undo
                        </button>
                        {canRedo && (
                            <button 
                                onClick={redo}
                                className="text-xs px-2 py-1 bg-blue-100 hover:bg-blue-200 rounded text-blue-700"
                            >
                                Redo
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Chat History with Action Buttons */}
            <div className='w-full flex-1 min-h-0 overflow-hidden'>
                <ChatHistory
                    chatMessages={chatMessages}
                    state={state}
                    onActionClick={handleActionClick}
                />
            </div>

            {/* Enhanced Chat Input */}
            <div className='w-full'>
                <ChatTextField
                    onSend={handleSendMessage}
                    message={message}
                    setMessage={setMessage}
                    placeholder="Ask me to edit your video, analyze timeline, or suggest improvements..."
                />
            </div>
        </div>
    )
}

export default Assistant