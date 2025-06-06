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
        // Initialize socket connection with polling fallback
        const newSocket = io(API_URL, {
            transports: ['polling', 'websocket'], // Start with polling, upgrade to websocket if possible
            path: '/socket.io/',
            reconnection: true,
            reconnectionAttempts: 10, // Reduced from Infinity
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            randomizationFactor: 0.5,
            timeout: 20000, // Reduced timeout
            autoConnect: true,
            forceNew: false, // Changed to false
            upgrade: true, // Allow transport upgrades
            rememberUpgrade: true, // Remember successful upgrades
            withCredentials: true // Include credentials for CORS
        });

        // Log connection events with better error handling
        newSocket.on('connect', () => {
            console.log('✅ AutoCut WebSocket connected successfully');
            console.log('Transport used:', newSocket.io.engine.transport.name);
        });

        newSocket.on('connect_error', (error) => {
            console.warn('⚠️ AutoCut WebSocket connection error (will retry with polling):', error.message);
            // Don't log full error details - this is expected in many production environments
        });

        newSocket.on('disconnect', (reason) => {
            console.log('📡 AutoCut WebSocket disconnected:', reason);
        });

        // Handle transport events
        newSocket.on('upgrade', () => {
            console.log('🚀 Upgraded to WebSocket transport');
        });

        newSocket.on('upgradeError', (error: any) => {
            console.log('⬇️ Transport upgrade failed, staying with polling');
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