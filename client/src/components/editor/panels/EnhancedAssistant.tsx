import React, { useRef, useState, useEffect } from 'react'
import { io, Socket } from 'socket.io-client'
import ChatHeader from '../assistant/ChatHeader'
import AssistantChatHistory from '../assistant/AssistantChatHistory'
import AssistantChatTextField from '../assistant/AssistantChatTextField'
import { API_URL } from '@/lib/config'
import { useAuth } from '@/contexts/AuthContext'
import { useAIAssistant } from '@/contexts/AIAssistantContext'
import { useEditor } from '@/contexts/EditorContext'
import { createClient } from '@supabase/supabase-js'

interface ChatMessage {
    id: number;
    message: string;
    sender: 'user' | 'assistant';
    type?: 'text' | 'commands' | 'suggestions' | 'analysis' | 'error' | 'search' | 'tool_actions';
    commands?: any[];
    searchResults?: any[];
    toolActions?: any[];
    executionResults?: any[];
    mode?: 'agent' | 'ask';
    mentionedTools?: string[];
    files?: File[];
}

interface AIEdit {
    id: string;
    type: 'add' | 'remove' | 'modify' | 'split' | 'merge';
    description: string;
    timestamp: Date;
    status: 'pending' | 'accepted' | 'rejected';
    details: {
        target?: string;
        before?: any;
        after?: any;
        position?: number;
    };
    commands?: any[];
}

interface Tool {
    id: string;
    name: string;
    description: string;
    icon: string;
}

const EnhancedAssistant = () => {
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
    const [aiEdits, setAiEdits] = useState<AIEdit[]>([])
    const [state, setState] = useState<string>('idle')
    const socketRef = useRef<Socket | null>(null)
    const [message, setMessage] = useState<string>("")
    const { session } = useAuth()
    const { project } = useEditor()
    
    // AI Assistant Context
    const {
        isInitialized,
        isAnalyzing,
        hasVideoAnalysis,
        processRequest,
        executeAICommands,
        assistant
    } = useAIAssistant()

    // Available tools for @ mentions
    const availableTools: Tool[] = [
        {
            id: 'captions',
            name: 'Captions',
            description: 'Generate and manage video captions',
            icon: '💬'
        },
        {
            id: 'text',
            name: 'Text',
            description: 'Add text overlays and titles',
            icon: '📝'
        },
        {
            id: 'transitions',
            name: 'Transitions',
            description: 'Add transitions between clips',
            icon: '🎬'
        },
        {
            id: 'voiceover',
            name: 'Voiceover',
            description: 'Generate AI voiceovers',
            icon: '🎤'
        },
        {
            id: 'stickers',
            name: 'Stickers',
            description: 'Add stickers and emojis',
            icon: '😀'
        },
        {
            id: 'timeline',
            name: 'Timeline',
            description: 'Edit timeline and clips',
            icon: '⏱️'
        },
        {
            id: 'audio',
            name: 'Audio',
            description: 'Audio editing and effects',
            icon: '🔊'
        },
        {
            id: 'effects',
            name: 'Effects',
            description: 'Visual effects and filters',
            icon: '✨'
        }
    ];

    // Initialize WebSocket connection
    useEffect(() => {
        if (session?.user?.id && project?.id) {
            const socket = io(API_URL, {
                auth: {
                    userId: session.user.id,
                    projectId: project.id
                }
            })

            socket.on('connect', () => {
                console.log('[WebSocket] Connected to server')
            })

            socket.on('disconnect', () => {
                console.log('[WebSocket] Disconnected from server')
            })

            socket.on('state_change', (data: { state: string }) => {
                setState(data.state)
            })

            socket.on('chat_response', (data: { message: string }) => {
                const assistantMessage: ChatMessage = {
                    id: chatMessages.length + 1,
                    message: data.message,
                    sender: 'assistant'
                }
                setChatMessages(prev => [...prev, assistantMessage])
                setState('idle')
            })

            socketRef.current = socket

            return () => {
                socket.disconnect()
            }
        }
    }, [session?.user?.id, project?.id])

    // Debug function to test server connectivity
    const testServerConnectivity = async () => {
        console.log('🔍 Testing server connectivity...');
        
        try {
            // Test 1: Basic health check
            const healthResponse = await fetch('/health');
            console.log('✅ Health check:', healthResponse.status, healthResponse.statusText);
            
            // Test 2: Direct AI test route
            const directTestResponse = await fetch('/api/ai/test-direct', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ test: 'connectivity' })
            });
            console.log('✅ Direct AI test:', directTestResponse.status, directTestResponse.statusText);
            
            // Test 3: AI test route with auth
            const supabase = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
            );
            const { data: { session } } = await supabase.auth.getSession();
            
            if (session?.access_token) {
                const authTestResponse = await fetch('/api/ai/test', {
                    headers: { 'Authorization': `Bearer ${session.access_token}` }
                });
                console.log('✅ Auth AI test:', authTestResponse.status, authTestResponse.statusText);
            } else {
                console.log('⚠️ No session found for auth test');
            }
            
        } catch (error) {
            console.error('❌ Server connectivity test failed:', error);
        }
    };

    // Run connectivity test on mount (only in development)
    useEffect(() => {
        if (process.env.NODE_ENV === 'development') {
            testServerConnectivity();
        }
    }, []);

    // Handle sending messages with new Cursor-style features
    const handleSendMessage = async (
        message: string, 
        mode: 'agent' | 'ask', 
        mentionedTools: string[], 
        files?: File[]
    ) => {
        if (!message.trim() && (!files || files.length === 0)) return;

        // Add user message to chat
        const userMessage: ChatMessage = {
            id: chatMessages.length + 1,
            message,
            sender: 'user',
            mode,
            mentionedTools,
            files
        };
        setChatMessages(prev => [...prev, userMessage]);

        setState('thinking');

        // PRIORITY 1: Try the new AI assistant system first (best UX with tool integration)
        if (isInitialized && assistant) {
            try {
                console.log('Using advanced AI assistant system');
                const response = await processRequest(message);
                
                const assistantMessage: ChatMessage = {
                    id: chatMessages.length + 2,
                    message: response.content,
                    sender: 'assistant',
                    type: response.type,
                    commands: response.commands,
                    searchResults: response.searchResults,
                    toolActions: response.toolActions,
                    executionResults: response.executionResults
                };

                setChatMessages(prev => [...prev, assistantMessage]);

                // If in Agent mode and we have commands, create AI edits for review
                if (mode === 'agent' && response.commands && response.commands.length > 0) {
                    const newEdit: AIEdit = {
                        id: `edit_${Date.now()}`,
                        type: 'modify',
                        description: `Agent action: ${message.substring(0, 50)}...`,
                        timestamp: new Date(),
                        status: 'pending',
                        details: {
                            target: 'Timeline',
                        },
                        commands: response.commands
                    };
                    setAiEdits(prev => [...prev, newEdit]);
                }

                setState('idle');
                return;
            } catch (error) {
                console.error('Advanced AI assistant failed:', error);
                // Fall through to WebSocket backup
            }
        }

        // PRIORITY 2: WebSocket chat fallback (maintains functionality)
        if (socketRef.current?.connected) {
            try {
                console.log('Using WebSocket chat system');
                
                // Set up one-time listeners for this specific message
                const messageHandler = (data: { text: string }) => {
                    const assistantMessage: ChatMessage = {
                        id: chatMessages.length + 2,
                        message: data.text,
                        sender: 'assistant',
                        type: 'text'
                    };
                    setChatMessages(prev => [...prev, assistantMessage]);
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
                socketRef.current.emit('chat_message', { 
                    message, 
                    useIdeation: mode === 'agent' 
                });
                
                // Set timeout to clean up if no response
                setTimeout(() => {
                    socketRef.current?.off('chat_message', messageHandler);
                    socketRef.current?.off('state_change', stateHandler);
                    
                    // If still thinking after timeout, show error
                    if (state === 'thinking') {
                        const timeoutMessage: ChatMessage = {
                            id: chatMessages.length + 2,
                            message: "⏱️ Request timed out. Please try again with a simpler request.",
                            sender: 'assistant',
                            type: 'error'
                        };
                        setChatMessages(prev => [...prev, timeoutMessage]);
                        setState('idle');
                    }
                }, 30000); // 30 second timeout
                
                return;
            } catch (error) {
                console.error('WebSocket chat failed:', error);
            }
        }

        // PRIORITY 3: Local fallback (basic functionality)
        console.log('Using local fallback system');
        const fallbackMessage: ChatMessage = {
            id: chatMessages.length + 2,
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

**Your request was:** "${message}"
**Mode:** ${mode === 'agent' ? 'Agent (would perform actions)' : 'Ask (would provide suggestions)'}
${mentionedTools.length > 0 ? `**Tools mentioned:** ${mentionedTools.join(', ')}` : ''}
${files && files.length > 0 ? `**Files uploaded:** ${files.length} file(s)` : ''}

Try asking: "What editing tools are available?" or "How do I add captions?"`,
            sender: 'assistant',
            type: 'error'
        };
        setChatMessages(prev => [...prev, fallbackMessage]);
        setState('idle');
    };

    // Handle command execution
    const handleExecuteCommands = async (commands: any[]) => {
        setState('executing');
        try {
            if (executeAICommands) {
                await executeAICommands(commands);
                
                const successMessage: ChatMessage = {
                    id: chatMessages.length + 1,
                    message: `✅ Successfully executed ${commands.length} command${commands.length > 1 ? 's' : ''}!`,
                    sender: 'assistant',
                    type: 'text'
                };
                setChatMessages(prev => [...prev, successMessage]);
            }
        } catch (error) {
            console.error('Command execution failed:', error);
            const errorMessage: ChatMessage = {
                id: chatMessages.length + 1,
                message: `❌ Failed to execute commands: ${error}`,
                sender: 'assistant',
                type: 'error'
            };
            setChatMessages(prev => [...prev, errorMessage]);
        }
        setState('idle');
    };

    // Handle AI edit actions
    const handleAcceptEdit = (editId: string) => {
        setAiEdits(prev => prev.map(edit => 
            edit.id === editId 
                ? { ...edit, status: 'accepted' as const }
                : edit
        ));
        
        // Execute the commands for this edit
        const edit = aiEdits.find(e => e.id === editId);
        if (edit?.commands) {
            handleExecuteCommands(edit.commands);
        }
    };

    const handleRejectEdit = (editId: string) => {
        setAiEdits(prev => prev.map(edit => 
            edit.id === editId 
                ? { ...edit, status: 'rejected' as const }
                : edit
        ));
    };

    const handleAcceptAllEdits = () => {
        const pendingEdits = aiEdits.filter(edit => edit.status === 'pending');
        setAiEdits(prev => prev.map(edit => 
            edit.status === 'pending' 
                ? { ...edit, status: 'accepted' as const }
                : edit
        ));
        
        // Execute all pending commands
        const allCommands = pendingEdits.flatMap(edit => edit.commands || []);
        if (allCommands.length > 0) {
            handleExecuteCommands(allCommands);
        }
    };

    const handleRejectAllEdits = () => {
        setAiEdits(prev => prev.map(edit => 
            edit.status === 'pending' 
                ? { ...edit, status: 'rejected' as const }
                : edit
        ));
    };

    // Get status message
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
        } else if (socketRef.current?.connected) {
            return "💬 Chat AI ready (basic functionality)";
        } else {
            return "⚠️ Connecting to AI services...";
        }
    };

    return (
        <div className="flex flex-col h-full bg-white">
            <ChatHeader />
            
            {/* Status indicator */}
            <div className="w-full mb-2 p-2 bg-gray-50 rounded text-xs text-gray-600 text-center">
                {getStatusMessage()}
                {hasVideoAnalysis && (
                    <span className="ml-2 text-green-600">🧠 Video analyzed</span>
                )}
                {socketRef.current?.connected && isInitialized && (
                    <span className="ml-2 text-blue-600">💬 Chat backup</span>
                )}
                {/* Debug button for testing connectivity */}
                <button 
                    onClick={testServerConnectivity}
                    className="ml-2 text-xs text-blue-500 hover:text-blue-700 underline"
                    title="Test server connectivity (check console for results)"
                >
                    🔍 Test Connection
                </button>
            </div>

            {/* Chat History with AI Edits */}
            <div className="flex-1 overflow-hidden">
                <AssistantChatHistory
                    chatMessages={chatMessages}
                    aiEdits={aiEdits}
                    state={state}
                    onExecuteCommands={handleExecuteCommands}
                    onAcceptEdit={handleAcceptEdit}
                    onRejectEdit={handleRejectEdit}
                    onAcceptAllEdits={handleAcceptAllEdits}
                    onRejectAllEdits={handleRejectAllEdits}
                />
            </div>

            {/* Enhanced Chat Input */}
            <div className="p-3 border-t border-gray-200">
                <AssistantChatTextField
                    onSend={handleSendMessage}
                    message={message}
                    setMessage={setMessage}
                    availableTools={availableTools}
                    disabled={state === 'thinking' || state === 'executing'}
                />
            </div>
        </div>
    )
}

export default EnhancedAssistant
 