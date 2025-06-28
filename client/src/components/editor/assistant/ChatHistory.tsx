import React, { useEffect, useRef } from 'react'
import ChatMessage from './ChatMessage'

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

interface ChatHistoryProps {
    chatMessages: ChatMessage[];
    state: string;
    onExecuteCommands?: (commands: any[]) => void;
    onAcceptAIEdit?: (messageId: number) => void;
    onRejectAIEdit?: (messageId: number) => void;
}

const getCommandDescription = (command: any): string => {
    switch (command.type) {
        case 'ADD_CLIP':
            return `Add clip: ${command.payload.clip.type} (${formatTime(command.payload.clip.timelineStartMs)} - ${formatTime(command.payload.clip.timelineEndMs)})`;
        case 'REMOVE_CLIP':
            return `Remove clip: ${command.payload.clip.id}`;
        case 'UPDATE_CLIP':
            return `Update clip: ${command.payload.before.id} (timing/properties)`;
        case 'ADD_TRACK':
            return `Add ${command.payload.track.type} track`;
        case 'REMOVE_TRACK':
            return `Remove track: ${command.payload.track.id}`;
        case 'BATCH':
            return `Batch operation: ${command.payload.commands.length} commands`;
        default:
            return `${command.type} operation`;
    }
};

const formatTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

const ChatHistory: React.FC<ChatHistoryProps> = ({ chatMessages, state, onExecuteCommands, onAcceptAIEdit, onRejectAIEdit }) => {
    const chatContainerRef = useRef<HTMLDivElement>(null);

    // Scroll to bottom when messages change or when state changes
    useEffect(() => {
        if (chatContainerRef.current) {
            const container = chatContainerRef.current;
            // Always scroll to bottom when messages change or when state changes
            container.scrollTop = container.scrollHeight;
        }
    }, [chatMessages, state]);

    // Render the content based on the state
    function renderContent(state: string) {
        switch (state) {
            case 'generating_output':
                return (
                    <div className='flex flex-row w-full text-sm px-3 py-2 items-center bg-gray-50 rounded-lg'>
                        <div className="flex flex-row items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                            <span className="text-gray-600 font-medium">Thinking</span>
                        </div>
                        <div className='bouncing-dots ml-2'>
                            <span className="bouncing-dot"></span>
                            <span className="bouncing-dot"></span>
                            <span className="bouncing-dot"></span>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    }

    return (
        <div
            ref={chatContainerRef}
            className="
                flex flex-col w-full h-full
                gap-1 pr-2 pb-2
                overflow-y-auto
                elegant-scrollbar
            "
        >
            {/* Welcome message when no chat messages */}
            {chatMessages.length === 0 && state === 'idle' && (
                <div className="flex flex-col items-center justify-center h-full text-center px-4">
                    <div className="flex flex-col items-center gap-4">
                        
                        {/* Welcome text */}
                        <div className="flex flex-col gap-2">
                            <h3 className="text-lg font-semibold text-gray-700">
                                🎬 AI Video Assistant
                            </h3>
                            <p className="text-sm text-gray-500 max-w-xs leading-relaxed">
                                I can help you edit your video intelligently. Upload a video and I'll analyze it to understand the content.
                            </p>
                        </div>
                        
                        {/* Suggestion bubbles */}
                        <div className="flex flex-col gap-2 mt-2">
                            <div className="text-xs text-gray-400 font-medium">Try asking:</div>
                            <div className="flex flex-col gap-1">
                                <div className="bg-blue-50 text-blue-600 text-xs px-3 py-1 rounded-full">
                                    "Remove all silent parts"
                                </div>
                                <div className="bg-purple-50 text-purple-600 text-xs px-3 py-1 rounded-full">
                                    "Find scenes where John is speaking"
                                </div>
                                <div className="bg-green-50 text-green-600 text-xs px-3 py-1 rounded-full">
                                    "Add captions to the entire video"
                                </div>
                                <div className="bg-orange-50 text-orange-600 text-xs px-3 py-1 rounded-full">
                                    "Add title 'Welcome' at the beginning"
                                </div>
                                <div className="bg-pink-50 text-pink-600 text-xs px-3 py-1 rounded-full">
                                    "Add smooth transitions between clips"
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {
                chatMessages.map((message) => (
                    <div key={message.id}>
                        <ChatMessage
                            id={message.id}
                            message={message.message}
                            sender={message.sender}
                        />
                        
                        {/* Render command execution buttons - only for manual commands, not auto-executed AI edits */}
                        {message.commands && message.commands.length > 0 && onExecuteCommands && message.type === 'commands' && (
                            <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                <div className="text-sm text-blue-800 mb-2">
                                    🎬 Editing Commands Ready ({message.commands.length} operations)
                                </div>
                                
                                <div className="space-y-1 mb-3">
                                    {message.commands.map((cmd, index) => (
                                        <div key={index} className="text-xs text-blue-600 bg-white px-2 py-1 rounded">
                                            {getCommandDescription(cmd)}
                                        </div>
                                    ))}
                                </div>
                                
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => onExecuteCommands(message.commands!)}
                                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                                    >
                                        Execute Commands
                                    </button>
                                    <button
                                        className="px-3 py-1 bg-gray-300 text-gray-700 text-sm rounded hover:bg-gray-400 transition-colors"
                                    >
                                        Review First
                                    </button>
                                </div>
                            </div>
                        )}
                        
                        {/* Render analysis status */}
                        {message.type === 'analysis' && (
                            <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-sm text-green-800">
                                📊 Video Analysis Update
                            </div>
                        )}
                        
                        {/* Render error status */}
                        {message.type === 'error' && (
                            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                                ⚠️ Error
                            </div>
                        )}
                        
                        {/* Render AI edit accept/reject buttons */}
                        {message.type === 'ai_edit' && onAcceptAIEdit && onRejectAIEdit && (
                            <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                                <div className="text-sm text-green-800 mb-3">
                                    AI Edit Applied - Do you want to keep this change?
                                </div>
                                
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => onAcceptAIEdit(message.id)}
                                        className="px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors flex items-center gap-2"
                                    >
                                        ✅ Accept Edit
                                    </button>
                                    <button
                                        onClick={() => onRejectAIEdit(message.id)}
                                        className="px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors flex items-center gap-2"
                                    >
                                        ❌ Reject & Undo
                                    </button>
                                </div>
                            </div>
                        )}
                        
                        {/* Render search results */}
                        {message.type === 'search' && message.searchResults && message.searchResults.length > 0 && (
                            <div className="mt-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                                <div className="text-sm text-purple-800 mb-2">
                                    🔍 Search Results ({message.searchResults.length} found)
                                </div>
                                <div className="space-y-2">
                                    {message.searchResults.slice(0, 5).map((result, index) => (
                                        <div key={index} className="bg-white p-2 rounded border">
                                            <div className="text-xs text-purple-600 font-medium">
                                                {formatTime(result.startMs)} - {formatTime(result.endMs)}
                                            </div>
                                            <div className="text-sm text-gray-700 mt-1">
                                                {result.content.substring(0, 100)}...
                                            </div>
                                            <div className="text-xs text-gray-500 mt-1">
                                                Type: {result.type} • Confidence: {Math.round(result.confidence * 100)}%
                                            </div>
                                        </div>
                                    ))}
                                    {message.searchResults.length > 5 && (
                                        <div className="text-xs text-purple-600">
                                            And {message.searchResults.length - 5} more results...
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        
                        {/* Render tool actions */}
                        {message.type === 'tool_actions' && message.toolActions && message.toolActions.length > 0 && (
                            <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                                <div className="text-sm text-green-800 mb-2">
                                    🛠️ Tool Actions Executed ({message.toolActions.length} actions)
                                </div>
                                <div className="space-y-1">
                                    {message.toolActions.map((action, index) => (
                                        <div key={index} className="bg-white p-2 rounded border">
                                            <div className="text-xs text-green-600 font-medium">
                                                {action.toolName} • {action.action}
                                            </div>
                                            <div className="text-sm text-gray-700">
                                                {action.description}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                
                                {/* Show execution results if available */}
                                {message.executionResults && (
                                    <div className="mt-2 pt-2 border-t border-green-200">
                                        <div className="text-xs text-green-700 mb-1">Execution Results:</div>
                                        {message.executionResults.map((result, index) => (
                                            <div key={index} className={`text-xs p-1 rounded ${
                                                result.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                            }`}>
                                                {result.success ? '✅' : '❌'} {result.message}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))
            }

            {/* State */}
            {renderContent(state)}
        </div>
    )
}

export default ChatHistory