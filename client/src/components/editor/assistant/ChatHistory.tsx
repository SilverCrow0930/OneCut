import React, { useEffect, useRef } from 'react'
import ChatMessage from './ChatMessage'

interface ChatMessage {
    id: number;
    message: string;
    sender: 'user' | 'assistant';
}

interface ChatHistoryProps {
    chatMessages: ChatMessage[];
    state: string;
}

const ChatHistory: React.FC<ChatHistoryProps> = ({ chatMessages, state }) => {
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
                    <div className='flex flex-row w-full text-sm px-4 py-3 items-center bg-gray-50 rounded-lg'>
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
                gap-2 pr-2 pb-4
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
                                Hi there! 👋
                            </h3>
                            <p className="text-sm text-gray-500 max-w-xs leading-relaxed">
                                I'm your creative assistant!
                            </p>
                        </div>
                        
                        {/* Suggestion bubbles */}
                        <div className="flex flex-col gap-2 mt-2">
                            <div className="text-xs text-gray-400 font-medium">Try asking:</div>
                            <div className="flex flex-col gap-1">
                                <div className="bg-blue-50 text-blue-600 text-xs px-3 py-1 rounded-full">
                                    "Help me brainstorm video ideas"
                                </div>
                                <div className="bg-purple-50 text-purple-600 text-xs px-3 py-1 rounded-full">
                                    "What's trending in content?"
                                </div>
                                <div className="bg-green-50 text-green-600 text-xs px-3 py-1 rounded-full">
                                    "How can I improve my editing?"
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {
                chatMessages.map((message) => (
                    <ChatMessage
                        key={message.id}
                        id={message.id}
                        message={message.message}
                        sender={message.sender}
                    />
                ))
            }

            {/* State */}
            {renderContent(state)}
        </div>
    )
}

export default ChatHistory