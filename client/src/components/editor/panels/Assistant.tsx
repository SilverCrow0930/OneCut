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
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
        {
            id: 1,
            message: "👋 Welcome to your AI video assistant! I'm here to help you edit your videos intelligently.\n\n🎬 **What I can do:**\n• Analyze your video content\n• Find specific scenes or moments\n• Remove silent parts automatically\n• Cut at natural speech breaks\n• Add captions, text, and transitions\n• Suggest improvements\n\n💡 **Try asking me:**\n• \"Remove all silent parts\"\n• \"Find scenes where someone is speaking\"\n• \"Add captions to this video\"\n• \"Cut this clip at natural breaks\"\n\nJust type your request below and I'll help you edit like a pro! ✨",
            sender: 'assistant',
            type: 'text'
        }
    ])
    const [state, setState] = useState<string>('idle')
    const [isWebSocketConnected, setIsWebSocketConnected] = useState<boolean>(false)
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
            setIsWebSocketConnected(true);
        });

        socketRef.current.on('connect_error', (error) => {
            console.error('WebSocket connection error:', error);
            setIsWebSocketConnected(false);
        });

        socketRef.current.on('disconnect', (reason) => {
            console.log('WebSocket disconnected:', reason);
            if (reason === 'io server disconnect') {
                // Server initiated disconnect, try to reconnect
                socketRef.current?.connect();
            }
            setIsWebSocketConnected(false);
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

        // DEBUGGING: Test different endpoints to identify the issue
        if (message.toLowerCase().includes('test')) {
            try {
                console.log('Testing endpoints...');
                
                // Test 1: Health check (no auth)
                const healthResponse = await fetch('/api/ai/health');
                console.log('Health check:', healthResponse.status, await healthResponse.text());
                
                // Test 2: POST test (no auth)
                const postTestResponse = await fetch('/api/ai/test-post', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ test: 'data' })
                });
                console.log('POST test:', postTestResponse.status, await postTestResponse.text());
                
                // Test 3: Assistant endpoint (with auth)
                const assistantResponse = await fetch('/api/ai/assistant', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session?.access_token}`
                    },
                    body: JSON.stringify({ prompt: 'test' })
                });
                console.log('Assistant test:', assistantResponse.status, await assistantResponse.text());
                
                setChatMessages(prev => [...prev, {
                    id: prev.length + 1,
                    message: 'Test completed - check console for results',
                    sender: 'assistant'
                }]);
                setState('idle');
                return;
                
            } catch (error) {
                console.error('Test failed:', error);
                setChatMessages(prev => [...prev, {
                    id: prev.length + 1,
                    message: `Test failed: ${error}`,
                    sender: 'assistant'
                }]);
                setState('idle');
                return;
            }
        }

        // PRIORITY 1: Try HTTP API first (most reliable)
        try {
            console.log('Using HTTP AI assistant API');
            console.log('Session token:', session?.access_token ? 'Present' : 'Missing');
            
            const response = await fetch('/api/ai/assistant', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({
                    prompt: message,
                    semanticJSON: null, // Will be added when video analysis is implemented
                    currentTimeline: null // Will be added when timeline integration is ready
                })
            });

            console.log('HTTP Response status:', response.status, response.statusText);
            console.log('HTTP Response headers:', Object.fromEntries(response.headers.entries()));

            if (!response.ok) {
                const errorText = await response.text();
                console.error('HTTP Error response body:', errorText);
                throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
            }

            const data = await response.json();
            console.log('HTTP Response data:', data);
            
            setChatMessages(prev => [...prev, {
                id: prev.length + 1,
                message: data.response || 'I received your message but had trouble generating a response.',
                sender: 'assistant',
                type: 'text'
            }]);

            setState('idle');
            return; // Success - exit early
            
        } catch (error) {
            console.error('HTTP AI assistant failed with error:', error);
            
            // Provide more specific error messages based on the error
            let errorMessage = 'HTTP AI assistant failed, falling back to WebSocket';
            if (error instanceof Error) {
                if (error.message.includes('405')) {
                    errorMessage = 'Method not allowed (405) - there might be a routing issue';
                } else if (error.message.includes('401')) {
                    errorMessage = 'Authentication failed (401) - please refresh the page';
                } else if (error.message.includes('404')) {
                    errorMessage = 'Endpoint not found (404) - server might not be running';
                }
            }
            
            console.log(errorMessage + ':', error);
            // Don't return here - fall through to WebSocket fallback
        }

        // PRIORITY 2: Try the advanced AI assistant system (when available)
        if (isInitialized && assistant) {
            try {
                console.log('Using advanced AI assistant system');
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

                setState('idle');
                return; // Success - exit early
                
            } catch (error) {
                console.log('Advanced AI assistant failed, falling back to WebSocket chat:', error);
                // Don't return here - fall through to WebSocket fallback
            }
        }

        // PRIORITY 3: Fall back to WebSocket chat system (maintains functionality)
        if (socketRef.current && socketRef.current.connected) {
            try {
                console.log('Using WebSocket chat fallback');
                
                // Set up one-time listeners for this specific message
                const messageHandler = (data: { text: string }) => {
                    setChatMessages(prev => [...prev, {
                        id: prev.length + 1,
                        message: data.text,
                        sender: 'assistant',
                        type: 'text'
                    }]);
                    setState('idle');
                    
                    // Clean up listeners
                    socketRef.current?.off('chat_message', messageHandler);
                    socketRef.current?.off('state_change', stateHandler);
                };

                const stateHandler = (data: { state: string }) => {
                    setState(data.state);
                };

                socketRef.current.on('chat_message', messageHandler);
                socketRef.current.on('state_change', stateHandler);
                
                // Send the message
                socketRef.current.emit('chat_message', { message, useIdeation });
                
                // Set timeout to clean up if no response
                setTimeout(() => {
                    socketRef.current?.off('chat_message', messageHandler);
                    socketRef.current?.off('state_change', stateHandler);
                }, 30000); // 30 second timeout
                
                return; // WebSocket request sent - exit early
                
            } catch (error) {
                console.error('WebSocket chat also failed:', error);
                // Fall through to final error handling
            }
        }

        // PRIORITY 4: Final fallback - show helpful error message
        console.error('All AI systems failed, showing error message');
        setChatMessages(prev => [...prev, {
            id: prev.length + 2,
            message: `🔌 **Connection Issue**
            
I'm having trouble connecting to the AI services right now. Here are some things you can try:

**Immediate Solutions:**
• Refresh the page and try again
• Check your internet connection
• Try a simpler request like "help" or "what can you do"

**If the issue persists:**
• The server may need to be restarted
• AI services might be temporarily unavailable

**What I can still help with:**
• General video editing guidance
• Tool explanations and tutorials
• Best practices and tips

Try asking: "What editing tools are available?" or "How do I add captions?"`,
            sender: 'assistant',
            type: 'error'
        }]);
        
        setState('idle');
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
        if (state === 'thinking') return "Thinking...";
        if (state === 'executing') return "Executing commands...";
        
        // Show which system is available
        if (isInitialized && assistant && hasVideoAnalysis) {
            return "🧠 Advanced AI ready (with video understanding)";
        } else if (isInitialized && assistant) {
            return "🤖 Advanced AI ready (upload video for full features)";
        } else if (isWebSocketConnected) {
            return "💬 Chat AI ready (basic functionality)";
        } else {
            return "⚠️ Connecting to AI services...";
        }
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
                {isWebSocketConnected && isInitialized && (
                    <span className="ml-2 text-blue-600">💬 Chat backup</span>
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