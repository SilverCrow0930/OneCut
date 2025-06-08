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
    startProjectPolling: (projectId: string) => void;
    stopProjectPolling: () => void;
}

const QuickClipsContext = createContext<QuickClipsContextType | undefined>(undefined);

export function QuickClipsProvider({ children }: { children: ReactNode }) {
    const [socket, setSocket] = useState<Socket | null>(null);
    const socketRef = useRef<Socket | null>(null);
    const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const { user, session } = useAuth();

    // Function to poll project status
    const pollProjectStatus = async (projectId: string) => {
        if (!session?.access_token) return;

        try {
            const response = await fetch(`${API_URL}/api/v1/projects/${projectId}`, {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch project status');
            }

            const project = await response.json();
            
            // Emit state update based on project status
            if (socket) {
                const state: QuickClipsState = {
                    state: project.processing_status,
                    message: project.processing_message || '',
                    progress: project.processing_progress || 0
                };
                socket.emit('quickclips_state', state);

                // If completed, emit the response with clips
                if (project.processing_status === 'completed' && project.processing_result?.clips) {
                    socket.emit('quickclips_response', {
                        success: true,
                        clips: project.processing_result.clips,
                        processingTime: project.processing_result.processingTime
                    });

                    // Stop polling once we have the clips
                    stopProjectPolling();
                }

                // If failed, emit error
                if (project.processing_status === 'failed') {
                    socket.emit('quickclips_response', {
                        success: false,
                        error: project.processing_error || 'Processing failed'
                    });
                    stopProjectPolling();
                }
            }
        } catch (error) {
            console.error('Error polling project status:', error);
        }
    };

    // Start polling function
    const startProjectPolling = (projectId: string) => {
        // Clear any existing polling
        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
        }

        // Start polling every 2 seconds
        pollProjectStatus(projectId); // Initial poll
        pollingIntervalRef.current = setInterval(() => pollProjectStatus(projectId), 2000);
    };

    // Stop polling function
    const stopProjectPolling = () => {
        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
        }
    };

    useEffect(() => {
        if (!session?.access_token) {
            // If no auth token, disconnect existing socket and stop polling
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
                setSocket(null);
            }
            stopProjectPolling();
            return;
        }

        console.log('Initializing QuickClips WebSocket connection to:', API_URL);
        
        // Initialize socket connection with auth token
        const newSocket = io(API_URL, {
            transports: ['websocket'],
            path: '/socket.io/',
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            randomizationFactor: 0.5,
            timeout: 60000,
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
            console.error('QuickClips WebSocket connection error:', error);
            // Start polling as fallback on websocket error
            if (pollingIntervalRef.current) {
                console.log('Continuing with polling as fallback after websocket error');
            }
        });

        newSocket.on('disconnect', (reason) => {
            console.log('QuickClips WebSocket disconnected:', reason);
            // On disconnect, ensure we're polling if we were previously
            if (pollingIntervalRef.current) {
                // The interval is still running, which means we were actively monitoring a project
                // We'll let the polling continue as a fallback
                console.log('Continuing with polling as fallback after websocket disconnect');
            }
        });

        socketRef.current = newSocket;
        setSocket(newSocket);

        // Cleanup on unmount or when auth changes
        return () => {
            console.log('Cleaning up QuickClips WebSocket connection');
            if (newSocket) {
                newSocket.disconnect();
            }
            stopProjectPolling();
        };
    }, [session?.access_token, user?.id]); // Reconnect when auth changes

    const sendQuickClipsRequest = (data: QuickClipsEvent) => {
        if (socket) {
            console.log('Sending quickclips request:', data);
            socket.emit('quickclips', data);
            // Start polling as a fallback when sending a request
            startProjectPolling(data.projectId);
        } else {
            console.error('Cannot send quickclips request: socket not connected');
            // Start polling even if socket is not connected
            startProjectPolling(data.projectId);
        }
    };

    const onQuickClipsResponse = (callback: (response: QuickClipsResponse) => void) => {
        if (socket) {
            socket.on('quickclips_response', (response) => {
                // Stop polling when we get a final response
                if (response.success || response.error) {
                    stopProjectPolling();
                }
                callback(response);
            });
        }
    };

    const onQuickClipsState = (callback: (state: QuickClipsState) => void) => {
        if (socket) {
            socket.on('quickclips_state', (state) => {
                callback(state);
                // Stop polling if we reach a final state
                if (state.state === 'completed' || state.state === 'error') {
                    stopProjectPolling();
                }
            });
        }
    };

    return (
        <QuickClipsContext.Provider value={{
            socket,
            sendQuickClipsRequest,
            onQuickClipsResponse,
            onQuickClipsState,
            startProjectPolling,
            stopProjectPolling
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