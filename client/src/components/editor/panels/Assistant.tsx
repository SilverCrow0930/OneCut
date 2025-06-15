import React, { useRef, useState, useEffect } from 'react'
import { io, Socket } from 'socket.io-client'
import ChatHeader from '../assistant/ChatHeader'
import ChatHistory from '../assistant/ChatHistory'
import ChatTextField from '../assistant/ChatTextField'
import { API_URL } from '@/lib/config'
import { useAuth } from '@/contexts/AuthContext'
import { useAIAssistant } from '@/contexts/AIAssistantContext'
import { useEditor } from '@/contexts/EditorContext'

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

const Assistant = () => {
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
    const [state, setState] = useState<string>('idle')
    const socketRef = useRef<Socket | null>(null)
    const [message, setMessage] = useState<string>("")
    const { session } = useAuth()
    const { project } = useEditor()
    
    const {
        assistant,
        isInitialized,
        isAnalyzing,
        hasVideoAnalysis,
        initializeWithVideo,
        processRequest,
        executeAICommands,
        findContent,
        error,
        clearError
    } = useAIAssistant()

    // Initialize video analysis when project loads
    useEffect(() => {
        if (project && isInitialized && !hasVideoAnalysis) {
            // For now, we'll skip auto-analysis and let user trigger it manually
            // This can be enhanced later when we have proper asset management
            console.log('AI Assistant ready for video analysis');
        }
    }, [project, isInitialized, hasVideoAnalysis]);

    // Display analysis status
    useEffect(() => {
        if (isAnalyzing) {
            setChatMessages(prev => [...prev, {
                id: prev.length + 1,
                message: "🎬 Analyzing your video to understand its content. This may take a moment...",
                sender: 'assistant',
                type: 'analysis'
            }]);
            setState('analyzing');
        } else if (hasVideoAnalysis && state === 'analyzing') {
            setChatMessages(prev => [...prev, {
                id: prev.length + 1,
                message: "✅ Video analysis complete! I now understand your content and can help with intelligent editing. Try asking me to:\n\n• Find specific scenes or moments\n• Remove silent parts\n• Cut at natural speech breaks\n• Organize similar content\n• Suggest improvements",
                sender: 'assistant',
                type: 'analysis'
            }]);
            setState('ready');
        }
    }, [isAnalyzing, hasVideoAnalysis, state]);

    // Display errors
    useEffect(() => {
        if (error) {
            setChatMessages(prev => [...prev, {
                id: prev.length + 1,
                message: `❌ Error: ${error}`,
                sender: 'assistant',
                type: 'error'
            }]);
            clearError();
        }
    }, [error, clearError]);

    useEffect(() => {
        // Initialize socket connection with proper configuration
        socketRef.current = io(API_URL, {
            transports: ['websocket'],  // Force WebSocket only
            path: '/socket.io/',
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            randomizationFactor: 0.5,
            timeout: 60000,  // Match server pingTimeout
            autoConnect: true,
            forceNew: true,
            upgrade: false,  // Disable transport upgrade
            rememberUpgrade: false
        });

        // Log connection events
        socketRef.current.on('connect', () => {
            console.log('WebSocket connected successfully');
        });

        socketRef.current.on('connect_error', (error) => {
            console.error('WebSocket connection error:', error);
        });

        socketRef.current.on('disconnect', (reason) => {
            console.log('WebSocket disconnected:', reason);
            if (reason === 'io server disconnect') {
                // Server initiated disconnect, try to reconnect
                socketRef.current?.connect();
            }
        });

        socketRef.current.on('reconnect_attempt', (attemptNumber) => {
            console.log('Reconnection attempt:', attemptNumber);
        });

        socketRef.current.on('reconnect', (attemptNumber) => {
            console.log('Reconnected after', attemptNumber, 'attempts');
        });

        socketRef.current.on('reconnect_error', (error) => {
            console.error('Reconnection error:', error);
        });

        socketRef.current.on('reconnect_failed', () => {
            console.error('Failed to reconnect');
        });

        // Listen for chat messages from the server
        socketRef.current.on('chat_message', (data: { text: string }) => {
            setChatMessages(prev => [...prev, {
                id: prev.length + 1,
                message: data.text,
                sender: 'assistant'
            }])
        })

        // Listen for state changes
        socketRef.current.on('state_change', (data: { state: string }) => {
            setState(data.state)
        })

        // Cleanup on unmount
        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect()
            }
        }
    }, [])

    const handleVideoAnalysis = async (videoUrl: string, mimeType: string) => {
        try {
            await initializeWithVideo(videoUrl, mimeType);
        } catch (error) {
            console.error('Video analysis failed:', error);
        }
    };

    const handleSendMessage = async (message: string, useIdeation: boolean) => {
        if (!message.trim()) return;

        // Add user message to chat
        const userMessage: ChatMessage = {
            id: chatMessages.length + 1,
            message,
            sender: 'user'
        };
        setChatMessages(prev => [...prev, userMessage]);

        setState('thinking');

        try {
            if (isInitialized && assistant) {
                // Use the new AI assistant
                const response = await processRequest(message);
                
                let assistantMessage: ChatMessage = {
                    id: chatMessages.length + 2,
                    message: response.content,
                    sender: 'assistant',
                    type: response.type,
                    searchResults: response.searchResults,
                    toolActions: response.toolActions,
                    executionResults: response.executionResults
                };

                if (response.commands && response.commands.length > 0) {
                    assistantMessage.commands = response.commands;
                    assistantMessage.message += "\n\n🎬 I've prepared some editing commands. Would you like me to execute them?";
                }

                setChatMessages(prev => [...prev, assistantMessage]);

                // Auto-execute simple commands or ask for confirmation for complex ones
                if (response.commands && response.commands.length === 1 && 
                    ['UPDATE_CLIP', 'REMOVE_CLIP'].includes(response.commands[0].type)) {
                    await executeAICommands(response.commands);
                    setChatMessages(prev => [...prev, {
                        id: prev.length + 1,
                        message: "✅ Commands executed successfully!",
                        sender: 'assistant'
                    }]);
                }

            } else {
                // Fallback to socket-based chat
                if (socketRef.current) {
                    socketRef.current.emit('chat_message', { message, useIdeation });
                }
            }
        } catch (error) {
            console.error('Message processing failed:', error);
            setChatMessages(prev => [...prev, {
                id: prev.length + 2,
                message: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                sender: 'assistant',
                type: 'error'
            }]);
        } finally {
            setState('idle');
        }
    };

    const handleExecuteCommands = async (commands: any[]) => {
        try {
            setState('executing');
            await executeAICommands(commands);
            setChatMessages(prev => [...prev, {
                id: prev.length + 1,
                message: "✅ Commands executed successfully!",
                sender: 'assistant'
            }]);
        } catch (error) {
            console.error('Command execution failed:', error);
            setChatMessages(prev => [...prev, {
                id: prev.length + 1,
                message: `❌ Command execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                sender: 'assistant',
                type: 'error'
            }]);
        } finally {
            setState('idle');
        }
    };

    const getStatusMessage = () => {
        if (!isInitialized) return "Initializing AI assistant...";
        if (isAnalyzing) return "Analyzing video content...";
        if (!hasVideoAnalysis) return "Ready (no video analysis)";
        if (state === 'thinking') return "Thinking...";
        if (state === 'executing') return "Executing commands...";
        return "Ready with video understanding";
    };

    return (
        <div className="
            flex flex-col items-center justify-between w-full h-full
            p-2
        ">
            {/* Status indicator */}
            <div className="w-full mb-2 p-2 bg-gray-50 rounded text-xs text-gray-600 text-center">
                {getStatusMessage()}
                {hasVideoAnalysis && (
                    <span className="ml-2 text-green-600">🧠 Video analyzed</span>
                )}
            </div>

            {/* Chat History */}
            <div className='w-full flex-1 min-h-0 overflow-hidden'>
                <ChatHistory
                    chatMessages={chatMessages}
                    state={state}
                    onExecuteCommands={handleExecuteCommands}
                />
            </div>

            {/* Chat Text Field */}
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