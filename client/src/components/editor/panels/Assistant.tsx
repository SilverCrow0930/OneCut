import React, { useRef, useState } from 'react'
import ChatHeader from '../assistant/ChatHeader'
import ChatHistory from '../assistant/ChatHistory'
import ChatTextField from '../assistant/ChatTextField'

interface ChatMessage {
    id: number;
    message: string;
    sender: 'user' | 'assistant';
}

const Assistant = () => {
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
    const [state, setState] = useState<string>('idle')
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleSendMessage = (message: string) => {
        setChatMessages([...chatMessages, { id: chatMessages.length + 1, message, sender: 'user' }])
    }

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
    }

    return (
        <div className="
            flex flex-col items-center justify-between w-full h-full
            p-2
            bg-gray-100
        ">
            {/* Chat Header */}
            <ChatHeader />

            {/* Chat History */}
            <div className='w-full h-full flex-grow'>
                <ChatHistory
                    chatMessages={chatMessages}
                    state={state}
                />
            </div>

            {/* Chat Text Field */}
            <div className='w-full'>
                <ChatTextField
                    onSend={handleSendMessage}
                    onSubmit={handleSubmit}
                    fileInputRef={fileInputRef}
                />
            </div>
        </div>
    )
}

export default Assistant