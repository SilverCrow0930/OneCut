import React, { useRef, useState, useEffect } from 'react'
import { io, Socket } from 'socket.io-client'
import ChatHeader from '../assistant/ChatHeader'
import ChatHistory from '../assistant/ChatHistory'
import ChatTextField from '../assistant/ChatTextField'
import { API_URL } from '@/lib/config'
import { useAuth } from '@/contexts/AuthContext'

interface ChatMessage {
    id: number;
    message: string;
    sender: 'user' | 'assistant';
}

const Assistant = () => {
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
    const [state, setState] = useState<string>('idle')
    const socketRef = useRef<Socket | null>(null)
    const [message, setMessage] = useState<string>("")
    const { session } = useAuth()

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

    const handleSendMessage = (message: string, useIdeation: boolean) => {
        if (!socketRef.current) return

        // Add user message to chat
        setChatMessages(prev => [...prev, {
            id: prev.length + 1,
            message,
            sender: 'user'
        }])

        // Send message to server with ideation state
        socketRef.current.emit('chat_message', { message, useIdeation })
    }

    return (
        <div className="
            flex flex-col items-center justify-between w-full h-full
            p-2
        ">
            {/* Chat Header */}
            {/* <ChatHeader /> */}

            {/* Chat History */}
            <div className='w-full flex-1 min-h-0 overflow-hidden'>
                <ChatHistory
                    chatMessages={chatMessages}
                    state={state}
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