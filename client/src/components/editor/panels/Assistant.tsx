import React, { useRef, useState, useEffect } from 'react'
import { io, Socket } from 'socket.io-client'
import ChatHistory from '../assistant/ChatHistory'
import ChatTextField from '../assistant/ChatTextField'
import ChatHeader from '../assistant/ChatHeader'
import NotesPanel from '../assistant/NotesPanel'
import { API_URL } from '@/lib/config'
import { useAuth } from '@/contexts/AuthContext'
import { useEditor } from '@/contexts/EditorContext'
import { useAssets } from '@/contexts/AssetsContext'
import { useParams } from 'next/navigation'
import { Brain, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { createCommandExecutor } from '@/services/commandExecutor'

interface ChatMessage {
    id: number;
    message: string;
    sender: 'user' | 'assistant';
    type?: 'text' | 'commands' | 'suggestions' | 'analysis' | 'error' | 'search' | 'tool_actions' | 'ai_edit';
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
    const [activeView, setActiveView] = useState<'chat' | 'notes'>('chat')
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
    const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(true)
    const [state, setState] = useState<string>('idle')
    const [isWebSocketConnected, setIsWebSocketConnected] = useState<boolean>(false)
    const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false)
    const [hasVideoAnalysis, setHasVideoAnalysis] = useState<boolean>(false)
    const [videoAnalysis, setVideoAnalysis] = useState<VideoAnalysis | null>(null)
    const [analysisError, setAnalysisError] = useState<string | null>(null)
    
    const socketRef = useRef<Socket | null>(null)
    const [message, setMessage] = useState<string>("")
    const { session } = useAuth()
    const { clips, tracks, project, executeCommand, undo } = useEditor()
    const { assets } = useAssets()
    const params = useParams()
    const projectId = Array.isArray(params.projectId) ? params.projectId[0] : params.projectId

    // Load chat history and check for existing analysis on mount
    useEffect(() => {
        if (projectId && session?.access_token) {
            loadChatHistory()
            checkExistingAnalysis()
        }
    }, [projectId, session?.access_token])

    const loadChatHistory = async () => {
        if (!projectId || !session?.access_token) return

        try {
            setIsLoadingHistory(true)
            const response = await fetch(`${API_URL}/api/ai/chat-messages/${projectId}`, {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                }
            })

            if (response.ok) {
                const messages = await response.json()
                if (messages.length > 0) {
                    setChatMessages(messages)
                    console.log('Chat history loaded:', messages.length, 'messages')
                } else {
                    // Set welcome message if no history exists
                    setChatMessages([{
                        id: 1,
                        message: "👋 Welcome to your AI video assistant! I'm here to help you edit your videos intelligently.\n\n🎬 **What I can do:**\n• Answer questions about video editing\n• Provide editing tips and suggestions\n• Help with general video editing guidance\n• Analyze your video content (when you click the analysis button)\n\n💡 **To get started:**\n• Ask me any video editing questions\n• Click \"Analyze Video\" to let me understand your content\n• After analysis, I can give specific suggestions about your video\n\nJust type your question below! ✨",
                        sender: 'assistant',
                        type: 'text'
                    }])
                }
            } else if (response.status === 404) {
                // No chat history found, start with welcome message
                setChatMessages([{
                    id: 1,
                    message: "👋 Welcome to your AI video assistant! I'm here to help you edit your videos intelligently.\n\n🎬 **What I can do:**\n• Answer questions about video editing\n• Provide editing tips and suggestions\n• Help with general video editing guidance\n• Analyze your video content (when you click the analysis button)\n\n💡 **To get started:**\n• Ask me any video editing questions\n• Click \"Analyze Video\" to let me understand your content\n• After analysis, I can give specific suggestions about your video\n\nJust type your question below! ✨",
                    sender: 'assistant',
                    type: 'text'
                }])
            } else {
                console.error('Failed to load chat history:', response.status)
            }
        } catch (error) {
            console.error('Error loading chat history:', error)
            // Set welcome message on error
            setChatMessages([{
                id: 1,
                message: "👋 Welcome to your AI video assistant! I'm here to help you edit your videos intelligently.\n\n🎬 **What I can do:**\n• Answer questions about video editing\n• Provide editing tips and suggestions\n• Help with general video editing guidance\n• Analyze your video content (when you click the analysis button)\n\n💡 **To get started:**\n• Ask me any video editing questions\n• Click \"Analyze Video\" to let me understand your content\n• After analysis, I can give specific suggestions about your video\n\nJust type your question below! ✨",
                sender: 'assistant',
                type: 'text'
            }])
        } finally {
            setIsLoadingHistory(false)
        }
    }

    const saveChatMessage = async (message: string, sender: 'user' | 'assistant', type: string = 'text', metadata: any = {}) => {
        if (!projectId || !session?.access_token) return

        try {
            await fetch(`${API_URL}/api/ai/chat-messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    projectId,
                    message,
                    sender,
                    type,
                    metadata
                })
            })
        } catch (error) {
            console.error('Failed to save chat message:', error)
            // Don't block the UI if saving fails
        }
    }

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
            const successMessage = "🎉 Video analysis completed! I now understand your video content and can provide specific suggestions. Try asking me about:\n\n• Key moments in your video\n• Editing suggestions\n• Content optimization\n• Specific scenes or topics\n\nWhat would you like to know about your video?";
            setChatMessages(prev => [...prev, {
                id: prev.length + 1,
                message: successMessage,
                sender: 'assistant',
                type: 'analysis'
            }])
            // Save success message to database
            await saveChatMessage(successMessage, 'assistant', 'analysis');
            
            console.log('Video analysis completed successfully')
            
        } catch (error) {
            console.error('Video analysis failed:', error)
            const errorMessage = error instanceof Error ? error.message : 'Analysis failed'
            setAnalysisError(errorMessage)
            
            // Add error message to chat
            const fullErrorMessage = `❌ Video analysis failed: ${errorMessage}\n\nPlease try again or ask me general video editing questions.`;
            setChatMessages(prev => [...prev, {
                id: prev.length + 1,
                message: fullErrorMessage,
                sender: 'assistant',
                type: 'error'
            }])
            // Save error message to database
            await saveChatMessage(fullErrorMessage, 'assistant', 'error');
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
        socketRef.current.on('chat_message', async (data: { text: string, commands?: any[] }) => {
            const messageType = data.commands && data.commands.length > 0 ? 'commands' : 'text';
            const newMessage: ChatMessage = {
                id: chatMessages.length + 1,
                message: data.text,
                sender: 'assistant',
                type: messageType,
                commands: data.commands || []
            };
            
            setChatMessages(prev => [...prev, newMessage]);
            
            // Auto-execute commands if present
            if (data.commands && data.commands.length > 0) {
                // Remove commands from the original message to prevent showing manual execution UI
                setChatMessages(prev => prev.map(msg => 
                    msg.id === newMessage.id 
                        ? { ...msg, type: 'text' as const, commands: undefined }
                        : msg
                ));
                
                await handleExecuteCommands(data.commands, true); // true = auto-execute
            }
            
            // Save assistant message to database with commands metadata
            await saveChatMessage(data.text, 'assistant', messageType, {
                commands: data.commands || []
            });
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

        // Save user message to database
        await saveChatMessage(message, 'user', 'text');

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
            const errorMessage = "🔌 Not connected to AI service. Please refresh the page and try again.";
            setChatMessages(prev => [...prev, {
                id: prev.length + 2,
                message: errorMessage,
                sender: 'assistant',
                type: 'error'
            }]);
            // Save error message to database
            await saveChatMessage(errorMessage, 'assistant', 'error');
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

    const handleExecuteCommands = async (commands: any[], autoExecute: boolean = false) => {
        if (!projectId || !executeCommand) {
            console.error('Missing project ID or execute command function');
            return;
        }

        try {
            // Create command executor instance
            const executor = createCommandExecutor(
                projectId,
                executeCommand,
                tracks,
                clips
            );

            // Execute the AI commands
            const result = await executor.executeAICommands(commands);

            if (result.success) {
                if (autoExecute) {
                    // Add AI edit with accept/reject options
                    const editMessage = `**AI Edit Applied**\n\n${result.message}\n\n*You can accept or reject this edit below.*`;
                    setChatMessages(prev => [...prev, {
                        id: prev.length + 1,
                        message: editMessage,
                        sender: 'assistant',
                        type: 'ai_edit',
                        commands: result.commands || []
                    }]);
                    
                    // Save AI edit message to database
                    await saveChatMessage(editMessage, 'assistant', 'ai_edit', {
                        commands: result.commands || []
                    });
                } else {
                    // Manual execution - show success
                    const successMessage = `✅ Commands executed successfully!\n\n${result.message}`;
                    setChatMessages(prev => [...prev, {
                        id: prev.length + 1,
                        message: successMessage,
                        sender: 'assistant',
                        type: 'text'
                    }]);
                    
                    // Save success message to database
                    await saveChatMessage(successMessage, 'assistant', 'text');
                }
            } else {
                // Add error message to chat
                const errorMessage = `❌ Command execution failed: ${result.error || result.message}`;
                setChatMessages(prev => [...prev, {
                    id: prev.length + 1,
                    message: errorMessage,
                    sender: 'assistant',
                    type: 'error'
                }]);
                
                // Save error message to database
                await saveChatMessage(errorMessage, 'assistant', 'error');
            }
        } catch (error) {
            console.error('Command execution error:', error);
            
            const errorMessage = `❌ Failed to execute commands: ${error instanceof Error ? error.message : 'Unknown error'}`;
            setChatMessages(prev => [...prev, {
                id: prev.length + 1,
                message: errorMessage,
                sender: 'assistant',
                type: 'error'
            }]);
            
            // Save error message to database
            await saveChatMessage(errorMessage, 'assistant', 'error');
        }
    };

    const handleAcceptAIEdit = async (messageId: number) => {
        // Update the message to show it was accepted
        setChatMessages(prev => prev.map(msg => 
            msg.id === messageId 
                ? { ...msg, type: 'text' as const, message: msg.message.replace('*You can accept or reject this edit below.*', '✅ **Edit Accepted**') }
                : msg
        ));
        
        // Add acceptance message
        const acceptMessage = "✅ AI edit accepted and applied to your video.";
        setChatMessages(prev => [...prev, {
            id: prev.length + 1,
            message: acceptMessage,
            sender: 'assistant',
            type: 'text'
        }]);
        
        await saveChatMessage(acceptMessage, 'assistant', 'text');
    };

    const handleRejectAIEdit = async (messageId: number) => {
        // Undo the changes
        if (undo) {
            undo();
        }
        
        // Update the message to show it was rejected
        setChatMessages(prev => prev.map(msg => 
            msg.id === messageId 
                ? { ...msg, type: 'text' as const, message: msg.message.replace('*You can accept or reject this edit below.*', '❌ **Edit Rejected and Reverted**') }
                : msg
        ));
        
        // Add rejection message
        const rejectMessage = "❌ AI edit rejected. Your video has been restored to the previous state.";
        setChatMessages(prev => [...prev, {
            id: prev.length + 1,
            message: rejectMessage,
            sender: 'assistant',
            type: 'text'
        }]);
        
        await saveChatMessage(rejectMessage, 'assistant', 'text');
    };

    return (
        <div className="flex flex-col w-full h-full p-2">
            {/* Chat/Notes Toggle Header */}
            <div className="w-full mb-2">
                <ChatHeader 
                    activeView={activeView} 
                    onViewChange={setActiveView} 
                />
            </div>

            {/* Conditional Content Based on Active View */}
            {activeView === 'chat' ? (
                <>
                    {/* Header with Status and Video Analysis Button */}
                    <div className="w-full mb-2 p-2 bg-gray-50 rounded flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                            <span>{getStatusMessage()}</span>
                            {isWebSocketConnected && <span className="text-green-600">✅</span>}
                        </div>
                        
                        {/* Video Analysis Button - Compact */}
                        <button
                            onClick={handleVideoAnalysis}
                            disabled={isAnalyzing || !assets.some(a => a.mime_type?.startsWith('video/'))}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                                hasVideoAnalysis
                                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                    : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                            title={hasVideoAnalysis ? "Re-analyze Video" : "Analyze Video"}
                        >
                            {isAnalyzing ? (
                                <>
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    <span>Analyzing</span>
                                </>
                            ) : hasVideoAnalysis ? (
                                <>
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>Re-analyze</span>
                                </>
                            ) : (
                                <>
                                    <Brain className="w-3 h-3" />
                                    <span>Analyze</span>
                                </>
                            )}
                        </button>
                    </div>

                    {/* Error Messages */}
                    {analysisError && (
                        <div className="w-full mb-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600 flex items-center gap-2">
                            <AlertCircle className="w-3 h-3 flex-shrink-0" />
                            {analysisError}
                        </div>
                    )}
                    
                    {!assets.some(a => a.mime_type?.startsWith('video/')) && (
                        <div className="w-full mb-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700">
                            Add a video to your project to enable analysis
                        </div>
                    )}

                    {/* Chat */}
                    <div className='w-full flex-1 min-h-0 overflow-hidden'>
                        {isLoadingHistory ? (
                            <div className="flex items-center justify-center h-full">
                                <div className="flex items-center gap-2 text-gray-500">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span className="text-sm">Loading chat history...</span>
                                </div>
                            </div>
                        ) : (
                        <ChatHistory
                            chatMessages={chatMessages}
                            state={state}
                                onExecuteCommands={handleExecuteCommands}
                                onAcceptAIEdit={handleAcceptAIEdit}
                                onRejectAIEdit={handleRejectAIEdit}
                        />
                        )}
                    </div>

                    {/* Input */}
                    <div className='w-full'>
                        <ChatTextField
                            onSend={handleSendMessage}
                            message={message}
                            setMessage={setMessage}
                        />
                    </div>
                </>
            ) : (
                /* Notes Panel */
                <div className="w-full flex-1 min-h-0 overflow-hidden">
                    <NotesPanel className="h-full" />
                </div>
            )}
        </div>
    )
}

export default Assistant