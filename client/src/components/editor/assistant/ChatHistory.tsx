import React, { useRef, useEffect } from 'react'
import ChatMessage from './ChatMessage'
import Thinking from './Thinking'

interface VideoAction {
    type: 'ADD_CLIP' | 'REMOVE_CLIP' | 'UPDATE_CLIP' | 'SPLIT_CLIP' | 'TRIM_CLIP' | 'ADD_TRANSITION' | 'ADJUST_SPEED' | 'AUTO_CUT' | 'SUGGESTION';
    description: string;
    data?: any;
}

interface ChatMessage {
    id: number;
    message: string;
    sender: 'user' | 'assistant';
    actions?: VideoAction[];
}

interface ChatHistoryProps {
    chatMessages: ChatMessage[]
    state: string
    onActionClick?: (action: VideoAction) => void
}

const ChatHistory: React.FC<ChatHistoryProps> = ({ chatMessages, state, onActionClick }) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null)

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight
        }
    }, [chatMessages])

    const getActionIcon = (actionType: string) => {
        switch (actionType) {
            case 'ADD_CLIP': return '➕'
            case 'REMOVE_CLIP': return '🗑️'
            case 'SPLIT_CLIP': return '✂️'
            case 'TRIM_CLIP': return '📏'
            case 'ADJUST_SPEED': return '⚡'
            case 'ADD_TRANSITION': return '🎬'
            case 'AUTO_CUT': return '🤖'
            case 'SUGGESTION': return '💡'
            default: return '🔧'
        }
    }

    const getActionColor = (actionType: string) => {
        switch (actionType) {
            case 'ADD_CLIP': return 'bg-green-100 hover:bg-green-200 text-green-700 border-green-300'
            case 'REMOVE_CLIP': return 'bg-red-100 hover:bg-red-200 text-red-700 border-red-300'
            case 'SPLIT_CLIP': return 'bg-blue-100 hover:bg-blue-200 text-blue-700 border-blue-300'
            case 'TRIM_CLIP': return 'bg-yellow-100 hover:bg-yellow-200 text-yellow-700 border-yellow-300'
            case 'ADJUST_SPEED': return 'bg-purple-100 hover:bg-purple-200 text-purple-700 border-purple-300'
            case 'ADD_TRANSITION': return 'bg-indigo-100 hover:bg-indigo-200 text-indigo-700 border-indigo-300'
            case 'AUTO_CUT': return 'bg-pink-100 hover:bg-pink-200 text-pink-700 border-pink-300'
            case 'SUGGESTION': return 'bg-orange-100 hover:bg-orange-200 text-orange-700 border-orange-300'
            default: return 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-300'
        }
    }

    return (
        <div className="flex flex-col w-full h-full">
            {/* Messages Container */}
            <div 
                ref={scrollContainerRef}
                className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth"
            >
                {chatMessages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center p-6">
                        <div className="text-6xl mb-4">🎬</div>
                        <h3 className="text-lg font-semibold text-gray-700 mb-2">AI Video Agent Ready</h3>
                        <p className="text-sm text-gray-500 max-w-xs leading-relaxed">
                            I can help you edit videos, analyze your timeline, suggest improvements, and automate editing tasks. 
                            Try asking me to:
                        </p>
                        <ul className="text-xs text-gray-600 mt-3 space-y-1 text-left">
                            <li>• "Split this clip at 30 seconds"</li>
                            <li>• "Speed up the selected clips by 2x"</li>
                            <li>• "Analyze my timeline for issues"</li>
                            <li>• "Add a transition between clips"</li>
                            <li>• "Remove all gaps in the timeline"</li>
                        </ul>
                    </div>
                )}

                {chatMessages.map((message) => (
                    <div key={message.id} className="space-y-2">
                        <ChatMessage 
                            id={message.id}
                            message={message.message} 
                            sender={message.sender} 
                        />
                        
                        {/* Render Action Buttons for Assistant Messages */}
                        {message.sender === 'assistant' && message.actions && message.actions.length > 0 && (
                            <div className="ml-4 space-y-2">
                                <div className="text-xs text-gray-500 font-medium">Available Actions:</div>
                                <div className="flex flex-wrap gap-2">
                                    {message.actions.map((action, index) => (
                                        <button
                                            key={index}
                                            onClick={() => onActionClick?.(action)}
                                            className={`
                                                inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium 
                                                border transition-all duration-200 hover:scale-105 hover:shadow-sm
                                                ${getActionColor(action.type)}
                                            `}
                                            title={action.description}
                                        >
                                            <span>{getActionIcon(action.type)}</span>
                                            <span className="truncate max-w-32">{action.description}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ))}

                {/* Thinking State */}
                {state === 'thinking' && (
                    <div className="flex justify-start">
                        <div className="bg-gray-100 rounded-2xl px-4 py-3 max-w-xs">
                            <Thinking />
                        </div>
                    </div>
                )}
                
                {/* Analysis State */}
                {state === 'analyzing' && (
                    <div className="flex justify-start">
                        <div className="bg-blue-100 rounded-2xl px-4 py-3 max-w-xs border border-blue-200">
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                <span className="text-sm text-blue-700 font-medium">Analyzing timeline...</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Processing State */}
                {state === 'processing' && (
                    <div className="flex justify-start">
                        <div className="bg-purple-100 rounded-2xl px-4 py-3 max-w-xs border border-purple-200">
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                                <span className="text-sm text-purple-700 font-medium">Processing video...</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default ChatHistory