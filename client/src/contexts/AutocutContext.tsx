import React, { createContext, useContext, useEffect, useRef, ReactNode, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { API_URL } from '@/lib/config';

interface AutoCutEvent {
    prompt: string;
    fileUri: string;
    mimeType: string;
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
        // Initialize socket connection with polling prioritized for production reliability
        const newSocket = io(API_URL, {
            transports: ['polling', 'websocket'], // Prioritize polling for production
            path: '/socket.io/',
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 2000,
            reconnectionDelayMax: 10000,
            randomizationFactor: 0.5,
            timeout: 30000, // Reduced timeout
            autoConnect: true,
            forceNew: false,
            upgrade: true, // Allow upgrade to websocket after polling works
            rememberUpgrade: false, // Don't remember failed websocket upgrades
            timestampRequests: true,
            timestampParam: 't'
        });

        // Log connection events
        newSocket.on('connect', () => {
            console.log('✅ WebSocket connected successfully');
            console.log('Transport used:', newSocket.io.engine.transport.name);
            console.log('Socket ID:', newSocket.id);
        });

        newSocket.on('connect_error', (error) => {
            console.error('❌ WebSocket connection error:', error);
            console.log('Attempting to reconnect...');
        });

        newSocket.on('disconnect', (reason) => {
            console.log('🔌 WebSocket disconnected:', reason);
            if (reason === 'io server disconnect') {
                console.log('Server initiated disconnect, attempting to reconnect...');
                newSocket.connect();
            }
        });

        newSocket.on('reconnect', (attemptNumber) => {
            console.log('🔄 Reconnected after', attemptNumber, 'attempts');
            console.log('Transport used:', newSocket.io.engine.transport.name);
        });

        newSocket.on('reconnect_attempt', (attemptNumber) => {
            console.log('🔄 Reconnection attempt #', attemptNumber);
        });

        newSocket.on('reconnect_error', (error) => {
            console.error('❌ Reconnection error:', error);
        });

        newSocket.on('reconnect_failed', () => {
            console.error('❌ Failed to reconnect after all attempts');
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