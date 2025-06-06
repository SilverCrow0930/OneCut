import React, { createContext, useContext, useEffect, useRef, ReactNode, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { API_URL } from '@/lib/config';

interface AutoCutEvent {
    prompt: string;
    fileUri: string;
    mimeType: string;
    contentType?: string;
    videoFormat?: string;
    targetDuration?: number;
}

interface AutoCutResponse {
    status: 'processing' | 'completed' | 'error';
    message?: string;
    result?: {
        clips: Array<{
            startTime: number;
            endTime: number;
            confidence: number;
        }>;
    };
}

interface AutoCutContextType {
    socket: Socket | null;
    sendAutoCutRequest: (data: AutoCutEvent) => void;
    onAutoCutResponse: (callback: (response: AutoCutResponse) => void) => void;
}

const AutoCutContext = createContext<AutoCutContextType | undefined>(undefined);

export function AutoCutProvider({ children }: { children: ReactNode }) {
    const [socket, setSocket] = useState<Socket | null>(null);
    const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        console.log('Initializing WebSocket connection to:', API_URL);
        // Initialize socket connection with polling fallback optimized for Render.com
        const newSocket = io(API_URL, {
            transports: ['polling', 'websocket'], // Start with polling for Render.com
            path: '/socket.io/',
            reconnection: true,
            reconnectionAttempts: 5, // Reduced attempts
            reconnectionDelay: 2000, // Increased delay
            reconnectionDelayMax: 10000,
            randomizationFactor: 0.5,
            timeout: 30000, // Increased timeout for Render.com
            autoConnect: true,
            forceNew: false,
            upgrade: true,
            rememberUpgrade: false, // Don't remember upgrades on Render.com
            withCredentials: true,
            // Add specific options for Render.com
            timestampRequests: true,
            timestampParam: 't'
        });

        // Log connection events
        newSocket.on('connect', () => {
            console.log('WebSocket connected successfully');
        });

        newSocket.on('connect_error', (error) => {
            console.error('WebSocket connection error:', error);
        });

        newSocket.on('disconnect', (reason) => {
            console.log('WebSocket disconnected:', reason);
        });

        socketRef.current = newSocket;
        setSocket(newSocket);

        // Cleanup on unmount
        return () => {
            console.log('Cleaning up WebSocket connection');
            if (newSocket) {
                newSocket.disconnect();
            }
        };
    }, []);

    const sendAutoCutRequest = (data: AutoCutEvent) => {
        if (socket) {
            console.log('Sending autocut request:', data);
            socket.emit('autocut', data);
        } else {
            console.error('Cannot send autocut request: socket not connected');
        }
    };

    const onAutoCutResponse = (callback: (response: AutoCutResponse) => void) => {
        if (socket) {
            socket.on('autocut_response', callback);
        }
    };

    return (
        <AutoCutContext.Provider value={{
            socket,
            sendAutoCutRequest,
            onAutoCutResponse
        }}>
            {children}
        </AutoCutContext.Provider>
    );
}

export function useAutoCut() {
    const context = useContext(AutoCutContext);
    if (context === undefined) {
        throw new Error('useAutoCut must be used within an AutoCutProvider');
    }
    return context;
} 