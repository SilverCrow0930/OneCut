import React, { useRef, useState, useEffect } from 'react'
import { io, Socket } from 'socket.io-client'
import ChatHistory from '../assistant/ChatHistory'
import ChatTextField from '../assistant/ChatTextField'
import { API_URL } from '@/lib/config'
import { useAuth } from '@/contexts/AuthContext'
import { useEditor } from '@/contexts/EditorContext'
import { useAssets } from '@/contexts/AssetsContext'
import { useParams } from 'next/navigation'
import { Brain, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

interface ChatMessage {
    id: number;
    message: string;
    sender: 'user' | 'assistant';
    type?: 'text' | 'commands' | 'suggestions' | 'analysis' | 'error' | 'search' | 'tool_actions';
    commands?: any[];
    searchResults?: any[];
    toolActions?: any[];
    executionResults?: any[];
}

interface VideoAnalysis {
    summary: string;
    scenes: Array<{
        startTime: number;
        endTime: number;
        description: string;
        emotions: string[];
        topics: string[];
    }>;
    transcript: string;
    keyMoments: Array<{
        timestamp: number;
        description: string;
        importance: number;
    }>;
    metadata: {
        duration: number;
        resolution?: string;
        fps?: number;
    };
}

const Assistant = () => {
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
        {
            id: 1,
            message: "👋 Welcome to your AI video assistant! I'm here to help you edit your videos intelligently.\n\n🎬 **What I can do:**\n• Answer questions about video editing\n• Provide editing tips and suggestions\n• Help with general video editing guidance\n• Analyze your video content (when you click the analysis button)\n\n💡 **To get started:**\n• Ask me any video editing questions\n• Click \"Analyze Video\" to let me understand your content\n• After analysis, I can give specific suggestions about your video\n\nJust type your question below! ✨",
            sender: 'assistant',
            type: 'text'
        }
    ])
    const [state, setState] = useState<string>('idle')
    const [isWebSocketConnected, setIsWebSocketConnected] = useState<boolean>(false)
    const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false)
    const [hasVideoAnalysis, setHasVideoAnalysis] = useState<boolean>(false)
    const [videoAnalysis, setVideoAnalysis] = useState<VideoAnalysis | null>(null)
    const [analysisError, setAnalysisError] = useState<string | null>(null)
    
    const socketRef = useRef<Socket | null>(null)
    const [message, setMessage] = useState<string>("")
    const { session } = useAuth()
    const { clips, tracks, project } = useEditor()
    const { assets } = useAssets()
    const params = useParams()
    const projectId = Array.isArray(params.projectId) ? params.projectId[0] : params.projectId

    // Check if analysis exists on mount
    useEffect(() => {
        checkExistingAnalysis()
    }, [projectId])

    const checkExistingAnalysis = async () => {
        if (!projectId || !session?.access_token) return

        try {
            const response = await fetch(`${API_URL}/api/ai/video-analysis/${projectId}`, {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                }
            })

            if (response.ok) {
                const analysis = await response.json()
                setVideoAnalysis(analysis)
                setHasVideoAnalysis(true)
                console.log('Existing video analysis loaded')
            }
        } catch (error) {
            console.log('No existing analysis found or error loading:', error)
        }
    }

    const handleVideoAnalysis = async () => {
        if (!projectId || !session?.access_token) {
            setAnalysisError('No project or session available')
            return
        }

        if (clips.length === 0) {
            setAnalysisError('No clips found in your project. Please add some clips to analyze.')
            return
        }

        setIsAnalyzing(true)
        setAnalysisError(null)
        
        try {
            console.log('Starting video analysis export for project:', projectId)
            console.log('Clips to analyze:', clips.length)
            
            // Get the current timeline data
            const timelineData = {
                clips: clips,
                tracks: tracks,
                projectId: projectId
            }
            
            const response = await fetch(`${API_URL}/api/ai/analyze-video-export`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify(timelineData)
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.error || `Analysis failed: ${response.status}`)
            }

            const analysis = await response.json()
            setVideoAnalysis(analysis)
            setHasVideoAnalysis(true)
            
            // Add success message to chat
            setChatMessages(prev => [...prev, {
                id: prev.length + 1,
                message: "🎉 Video analysis completed! I now understand your video content and can provide specific suggestions. Try asking me about:\n\n• Key moments in your video\n• Editing suggestions\n• Content optimization\n• Specific scenes or topics\n\nWhat would you like to know about your video?",
                sender: 'assistant',
                type: 'analysis'
            }])
            
            console.log('Video analysis completed successfully')
            
        } catch (error) {
            console.error('Video analysis failed:', error)
            const errorMessage = error instanceof Error ? error.message : 'Analysis failed'
            setAnalysisError(errorMessage)
            
            // Add error message to chat
            setChatMessages(prev => [...prev, {
                id: prev.length + 1,
                message: `❌ Video analysis failed: ${errorMessage}\n\nPlease try again or ask me general video editing questions.`,
                sender: 'assistant',
                type: 'error'
            }])
        } finally {
            setIsAnalyzing(false)
        }
    }

    useEffect(() => {
        // Only connect if we have a session
        if (!session?.access_token || !session?.user?.id) {
            console.log('No session available, skipping WebSocket connection');
            return;
        }

        // Initialize socket connection with authentication
        socketRef.current = io(API_URL, {
            transports: ['websocket'],
            path: '/socket.io/',
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            timeout: 20000,
            autoConnect: true,
            auth: {
                token: session.access_token,
                userId: session.user.id
            }
        });

        // Connection events
        socketRef.current.on('connect', () => {
            console.log('WebSocket connected successfully');
            setIsWebSocketConnected(true);
        });

        socketRef.current.on('connect_error', (error) => {
            console.error('WebSocket connection error:', error);
            setIsWebSocketConnected(false);
        });

        socketRef.current.on('disconnect', (reason) => {
            console.log('WebSocket disconnected:', reason);
            setIsWebSocketConnected(false);
        });

        // Chat message listener
        socketRef.current.on('chat_message', (data: { text: string }) => {
            setChatMessages(prev => [...prev, {
                id: prev.length + 1,
                message: data.text,
                sender: 'assistant'
            }])
            setState('idle');
        })

        // State change listener
        socketRef.current.on('state_change', (data: { state: string }) => {
            setState(data.state)
        })

        // Cleanup
        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect()
            }
        }
    }, [session])

    const handleSendMessage = async (message: string, useIdeation: boolean) => {
        if (!message.trim()) return;

        // Add user message
        const userMessage: ChatMessage = {
            id: chatMessages.length + 1,
            message,
            sender: 'user'
        };
        setChatMessages(prev => [...prev, userMessage]);

        setState('thinking');

        // Send via WebSocket with video analysis context if available
        if (socketRef.current && socketRef.current.connected) {
            const messageData = {
                message,
                useIdeation,
                videoAnalysis: hasVideoAnalysis ? videoAnalysis : null,
                projectContext: {
                    clips: clips.length,
                    tracks: clips.length > 0 ? [...new Set(clips.map(c => c.trackId))].length : 0,
                    totalDuration: clips.length > 0 ? Math.max(...clips.map(c => c.timelineEndMs)) : 0
                }
            }
            
            socketRef.current.emit('chat_message', messageData);
        } else {
            // Show error if not connected
            setChatMessages(prev => [...prev, {
                id: prev.length + 2,
                message: "🔌 Not connected to AI service. Please refresh the page and try again.",
                sender: 'assistant',
                type: 'error'
            }]);
            setState('idle');
        }
    };

    const getStatusMessage = () => {
        if (state === 'thinking') return "Thinking...";
        if (isAnalyzing) return "Analyzing video...";
        return isWebSocketConnected ? "💬 AI Chat ready" : "⚠️ Connecting...";
    };

    const getVideoAnalysisButtonText = () => {
        if (isAnalyzing) return "Analyzing...";
        if (hasVideoAnalysis) return "Re-analyze Video";
        return "Analyze Video";
    };

    return (
        <div className="flex flex-col w-full h-full p-2">
            {/* Status */}
            <div className="w-full mb-2 p-2 bg-gray-50 rounded text-xs text-gray-600 text-center">
                {getStatusMessage()}
                {isWebSocketConnected && <span className="ml-2 text-green-600">✅</span>}
            </div>

            {/* Video Analysis Button */}
            <div className="w-full mb-2">
                <button
                    onClick={handleVideoAnalysis}
                    disabled={isAnalyzing || !assets.some(a => a.mime_type?.startsWith('video/'))}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${
                        hasVideoAnalysis
                            ? 'bg-green-50 border border-green-200 text-green-700 hover:bg-green-100'
                            : 'bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                    {isAnalyzing ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Analyzing...
                        </>
                    ) : hasVideoAnalysis ? (
                        <>
                            <CheckCircle2 className="w-4 h-4" />
                            Video Analyzed - Re-analyze?
                        </>
                    ) : (
                        <>
                            <Brain className="w-4 h-4" />
                            Analyze Video
                        </>
                    )}
                </button>
                
                {analysisError && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600 flex items-center gap-2">
                        <AlertCircle className="w-3 h-3 flex-shrink-0" />
                        {analysisError}
                    </div>
                )}
                
                {!assets.some(a => a.mime_type?.startsWith('video/')) && (
                    <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700">
                        Add a video to your project to enable analysis
                    </div>
                )}
            </div>

            {/* Chat */}
            <div className='w-full flex-1 min-h-0 overflow-hidden'>
                <ChatHistory
                    chatMessages={chatMessages}
                    state={state}
                    onExecuteCommands={() => {}}
                />
            </div>

            {/* Input */}
            <div className='w-full'>
                <ChatTextField
                    onSend={handleSendMessage}
                    message={message}
                    setMessage={setMessage}
                />
            </div>
        </div>
    )
}

export default Assistant 