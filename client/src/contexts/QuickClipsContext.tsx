import React, { createContext, useContext, useEffect, useRef, ReactNode, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { API_URL } from '@/lib/config';

interface QuickClipsEvent {
    fileUri: string;
    mimeType: string;
    contentType?: string;
    targetDuration?: number;
    videoFormat?: string;
    outputMode?: 'individual' | 'stitched';
    projectId?: string;
}

interface QuickClip {
    id: string;
    title: string;
    duration: number;
    start_time: number;
    end_time: number;
    viral_score: number;
    description: string;
    thumbnail: string;
    downloadUrl: string;
    previewUrl: string;
}

interface QuickClipsResponse {
    success: boolean;
    clips?: QuickClip[];
    processingTime?: number;
    error?: string;
}

interface QuickClipsState {
    state: 'idle' | 'starting' | 'analyzing' | 'generating' | 'processing' | 'finalizing' | 'completed' | 'error';
    message: string;
    progress: number;
}

interface QuickClipsContextType {
    socket: Socket | null;
    sendQuickClipsRequest: (data: QuickClipsEvent) => void;
    onQuickClipsResponse: (callback: (response: QuickClipsResponse) => void) => void;
    onQuickClipsState: (callback: (state: QuickClipsState) => void) => void;
}

const QuickClipsContext = createContext<QuickClipsContextType | undefined>(undefined);

export function QuickClipsProvider({ children }: { children: ReactNode }) {
    const [socket, setSocket] = useState<Socket | null>(null);
    const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        console.log('Initializing QuickClips WebSocket connection to:', API_URL);
        
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
            console.log('✅ QuickClips WebSocket connected successfully');
            console.log('Transport used:', newSocket.io.engine.transport.name);
        });

        newSocket.on('connect_error', (error) => {
            console.warn('⚠️ QuickClips WebSocket connection error (will retry with polling):', error.message);
            // Don't log full error details - this is expected in many production environments
        });

        newSocket.on('disconnect', (reason) => {
            console.log('📡 QuickClips WebSocket disconnected:', reason);
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
            console.log('Cleaning up QuickClips WebSocket connection');
            if (newSocket) {
                newSocket.disconnect();
            }
        };
    }, []);

    const sendQuickClipsRequest = (data: QuickClipsEvent) => {
        if (socket) {
            console.log('Sending quickclips request:', data);
            socket.emit('quickclips', data);
        } else {
            console.error('Cannot send quickclips request: socket not connected');
        }
    };

    const onQuickClipsResponse = (callback: (response: QuickClipsResponse) => void) => {
        if (socket) {
            socket.on('quickclips_response', callback);
        }
    };

    const onQuickClipsState = (callback: (state: QuickClipsState) => void) => {
        if (socket) {
            socket.on('quickclips_state', callback);
        }
    };

    return (
        <QuickClipsContext.Provider value={{
            socket,
            sendQuickClipsRequest,
            onQuickClipsResponse,
            onQuickClipsState
        }}>
            {children}
        </QuickClipsContext.Provider>
    );
}

export function useQuickClips() {
    const context = useContext(QuickClipsContext);
    if (!context) {
        throw new Error('useQuickClips must be used within a QuickClipsProvider');
    }
    return context;
}

export type { QuickClip, QuickClipsResponse, QuickClipsState, QuickClipsEvent }; 