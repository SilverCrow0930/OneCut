import React from 'react'
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

    // Render the content based on the state
    function renderContent(state: string) {
        switch (state) {
            case 'generating_output':
                return (
                    <div className='flex flex-row w-full text-sm px-4'>
                        <h1>
                            Thinking
                        </h1>
                        <div className='bouncing-dots scale-[0.5]'>
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
        <div className="
            flex flex-col w-full h-full items-center
            gap-2
            overflow-y-scroll hide-scrollbar
        ">
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