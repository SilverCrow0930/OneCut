import React, { createContext, useContext, useEffect, useRef, ReactNode, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { API_URL } from '@/lib/config';
import { useAuth } from '@/contexts/AuthContext';

interface SmartCutClip {
    id: string;
    title: string;
    description: string;
    start_time: number;
    end_time: number;
    duration: number;
    significance: number;
    narrative_role: string;
    transition_note: string;
    downloadUrl: string;
    previewUrl: string;
    thumbnailUrl: string;
    format: string;
    aspectRatio: string;
}

interface SmartCutEvent {
    projectId: string;
    fileUri: string;
    mimeType: string;
    contentType?: string;
    targetDuration?: number;
    videoFormat?: string;
}

interface SmartCutResponse {
    success: boolean;
    clips?: SmartCutClip[];
    processingTime?: number;
    error?: string;
}

interface SmartCutState {
    state: 'idle' | 'starting' | 'analyzing' | 'generating' | 'processing' | 'finalizing' | 'completed' | 'error';
    message: string;
    progress: number;
}

interface SmartCutContextType {
    socket: Socket | null;
    sendSmartCutRequest: (data: SmartCutEvent) => void;
    onSmartCutResponse: (callback: (response: SmartCutResponse) => void) => void;
    onSmartCutState: (callback: (state: SmartCutState) => void) => void;
    // REST API methods
    processVideo: (file: File) => Promise<void>;
    isProcessing: boolean;
    progress: number;
    clips: SmartCutClip[] | null;
    error: string | null;
    clearResults: () => void;
}

const SmartCutContext = createContext<SmartCutContextType | undefined>(undefined);

export function SmartCutProvider({ children }: { children: ReactNode }) {
    const [socket, setSocket] = useState<Socket | null>(null);
    const socketRef = useRef<Socket | null>(null);
    const { user, session } = useAuth();
    
    // REST API state
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [clips, setClips] = useState<SmartCutClip[] | null>(null);
    const [error, setError] = useState<string | null>(null);

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
            console.log('Skipping Smart Cut WebSocket in production - using REST API only');
            return;
        }

        console.log('Initializing Smart Cut WebSocket connection to:', API_URL);
        
        // Initialize socket connection with auth token
        const newSocket = io(API_URL, {
            transports: ['websocket'],
            path: '/socket.io/',
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            randomizationFactor: 0.5,
            timeout: 30000,
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
            console.log('Smart Cut WebSocket connected successfully');
        });

        newSocket.on('connect_error', (error) => {
            console.warn('Smart Cut WebSocket connection error:', error);
        });

        newSocket.on('disconnect', (reason) => {
            console.log('Smart Cut WebSocket disconnected:', reason);
        });

        socketRef.current = newSocket;
        setSocket(newSocket);

        // Cleanup on unmount or when auth changes
        return () => {
            console.log('Cleaning up Smart Cut WebSocket connection');
            if (newSocket) {
                newSocket.disconnect();
            }
        };
    }, [session?.access_token, user?.id]);

    const sendSmartCutRequest = (data: SmartCutEvent) => {
        if (socket) {
            console.log('Sending smartcut request via WebSocket:', data);
            socket.emit('smartcut', data);
        } else {
            console.log('WebSocket not available - Smart Cut will use REST API only');
        }
    };

    const onSmartCutResponse = (callback: (response: SmartCutResponse) => void) => {
        if (socket) {
            socket.on('smartcut_response', callback);
        } else {
            console.log('WebSocket not available for Smart Cut responses');
        }
    };

    const onSmartCutState = (callback: (state: SmartCutState) => void) => {
        if (socket) {
            socket.on('smartcut_state', callback);
        } else {
            console.log('WebSocket not available for Smart Cut state updates');
        }
    };

    const processVideo = async (file: File) => {
        if (!session?.access_token) {
            setError('Authentication required');
            return;
        }

        setIsProcessing(true);
        setProgress(0);
        setError(null);
        setClips(null);

        try {
            const formData = new FormData();
            formData.append('video', file);

            const response = await fetch('/api/smartcut', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: formData,
            });

            if (!response.ok) {
                throw new Error('Failed to process video');
            }

            const data: SmartCutResponse = await response.json();

            if (data.success && data.clips) {
                setClips(data.clips);
                setProgress(100);
            } else if (!data.success) {
                throw new Error(data.error || 'Processing failed');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setIsProcessing(false);
        }
    };

    const clearResults = () => {
        setClips(null);
        setError(null);
        setProgress(0);
    };

    const value: SmartCutContextType = {
        socket,
        sendSmartCutRequest,
        onSmartCutResponse,
        onSmartCutState,
        processVideo,
        isProcessing,
        progress,
        clips,
        error,
        clearResults,
    };

    return (
        <SmartCutContext.Provider value={value}>
            {children}
        </SmartCutContext.Provider>
    );
}

export function useSmartCut() {
    const context = useContext(SmartCutContext);
    if (!context) {
        throw new Error('useSmartCut must be used within a SmartCutProvider');
    }
    return context;
}

export type { SmartCutClip, SmartCutResponse, SmartCutState, SmartCutEvent }; 