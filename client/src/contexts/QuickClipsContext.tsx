import React, { createContext, useContext, useEffect, useRef, ReactNode, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { API_URL } from '@/lib/config';
import { useAuth } from '@/contexts/AuthContext';

interface QuickClipsEvent {
    projectId: string;
    fileUri: string;
    mimeType: string;
    contentType?: string;
    targetDuration?: number;
    videoFormat?: string;
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
    const { user, session } = useAuth();

    useEffect(() => {
        if (!session?.access_token) {
            // If no auth token, disconnect existing socket
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
                setSocket(null);
            }
            return;
        }

        // Skip WebSocket connection if in production or if API_URL is not available
        if (process.env.NODE_ENV === 'production' || !API_URL) {
            console.log('Skipping QuickClips WebSocket in production - using REST API only');
            return;
        }

        console.log('Initializing QuickClips WebSocket connection to:', API_URL);
        
        // Initialize socket connection with auth token
        const newSocket = io(API_URL, {
            transports: ['websocket'],
            path: '/socket.io/',
            reconnection: true,
            reconnectionAttempts: 5, // Reduced from Infinity
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            randomizationFactor: 0.5,
            timeout: 30000, // Reduced from 60000
            autoConnect: true,
            forceNew: true,
            upgrade: false,
            rememberUpgrade: false,
            auth: {
                userId: user?.id,
                token: session.access_token
            }
        });

        // Log connection events
        newSocket.on('connect', () => {
            console.log('QuickClips WebSocket connected successfully');
        });

        newSocket.on('connect_error', (error) => {
            console.warn('QuickClips WebSocket connection error:', error);
            // Don't throw or crash - just log and continue without WebSocket
        });

        newSocket.on('disconnect', (reason) => {
            console.log('QuickClips WebSocket disconnected:', reason);
        });

        socketRef.current = newSocket;
        setSocket(newSocket);

        // Cleanup on unmount or when auth changes
        return () => {
            console.log('Cleaning up QuickClips WebSocket connection');
            if (newSocket) {
                newSocket.disconnect();
            }
        };
    }, [session?.access_token, user?.id]); // Reconnect when auth changes

    const sendQuickClipsRequest = (data: QuickClipsEvent) => {
        if (socket) {
            console.log('Sending quickclips request via WebSocket:', data);
            socket.emit('quickclips', data);
        } else {
            console.log('WebSocket not available - QuickClips will use REST API only');
        }
    };

    const onQuickClipsResponse = (callback: (response: QuickClipsResponse) => void) => {
        if (socket) {
            socket.on('quickclips_response', callback);
        } else {
            console.log('WebSocket not available for QuickClips responses');
        }
    };

    const onQuickClipsState = (callback: (state: QuickClipsState) => void) => {
        if (socket) {
            socket.on('quickclips_state', callback);
        } else {
            console.log('WebSocket not available for QuickClips state updates');
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