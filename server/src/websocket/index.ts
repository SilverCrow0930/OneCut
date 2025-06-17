import { Server, Socket } from 'socket.io';
import { generativeModel } from '../integrations/vertexAI.js';
import { generateContent, generateAIAssistantResponse } from '../integrations/googleGenAI.js';
import { bucket as gcsStorageBucket } from '../integrations/googleStorage.js';
import { Server as HttpServer } from 'http';
import { Storage } from '@google-cloud/storage';
import { queueQuickclipsJob } from '../services/quickclipsProcessor.js';
import { supabase } from '../config/supabaseClient.js';

// Add global type declaration
declare global {
    var io: Server | undefined
}

const googleSearchRetrievalTool = {
    googleSearchRetrieval: {
        disableAttribution: false,
    },
};

// Initialize GCS bucket
const storage = new Storage({
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    keyFilename: process.env.GOOGLE_CLOUD_KEY_FILE,
});
const bucket = storage.bucket(process.env.GOOGLE_CLOUD_STORAGE_BUCKET || 'lemona-edit-assets');

export const setupWebSocket = async (httpServer: HttpServer): Promise<Server> => {
    try {
        const io = new Server(httpServer, {
            path: '/socket.io/',
            transports: ['websocket'],
            cors: {
                origin: process.env.CLIENT_URL || 'http://localhost:3000',
                methods: ['GET', 'POST'],
                credentials: true
            }
        });

        // Store io instance in global scope for access from other modules
        global.io = io;

        // Middleware to authenticate socket connections
        io.use(async (socket, next) => {
            try {
                const token = socket.handshake.auth.token;
                const userId = socket.handshake.auth.userId;

                if (!token || !userId) {
                    return next(new Error('Authentication required'));
                }

                // Verify token with Supabase
                const { data: { user }, error: authError } = await supabase.auth.getUser(token);

                if (authError || !user || user.id !== userId) {
                    return next(new Error('Invalid authentication'));
                }

                // Store user data in socket
                socket.data.user = user;
                next();
            } catch (error) {
                console.error('[WebSocket] Authentication error:', error);
                next(new Error('Authentication failed'));
            }
        });

        io.on('connection', (socket: Socket) => {
            console.log(`[WebSocket] Client connected: ${socket.id}`);

            // Chat message handler for AI assistant
            socket.on('chat_message', async (data: { 
                message: string, 
                useIdeation?: boolean, 
                videoAnalysis?: any, 
                projectContext?: any 
            }) => {
                console.log(`[WebSocket] Chat message received from ${socket.id}:`, data.message);
                
                try {
                    // Emit thinking state
                    socket.emit('state_change', { state: 'thinking' });
                    
                    // Use the enhanced AI assistant response with video analysis context
                    const response = await generateAIAssistantResponse(
                        data.message, 
                        data.videoAnalysis, 
                        data.projectContext
                    );
                    
                    // Send the response back
                    socket.emit('chat_message', { 
                        text: response.response 
                    });
                    
                    // Reset state
                    socket.emit('state_change', { state: 'idle' });
                    
                } catch (error) {
                    console.error('[WebSocket] Chat error:', error);
                    
                    socket.emit('chat_message', { 
                        text: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.` 
                    });
                    
                    socket.emit('state_change', { state: 'idle' });
                }
            });

            // QuickClips handler
            socket.on('quickclips', async (data: {
                fileUri: string,
                mimeType: string,
                contentType?: string,
                targetDuration?: number,
                videoFormat?: string,
                projectId?: string
            }) => {
                const processStartTime = Date.now();
                console.log('=== QUICKCLIPS PROCESS STARTED ===');
                console.log('Request details:', {
                    fileUri: data.fileUri,
                    mimeType: data.mimeType,
                    contentType: data.contentType,
                    targetDuration: data.targetDuration,
                    videoFormat: data.videoFormat,
                    timestamp: new Date().toISOString(),
                    socketId: socket.id
                });

                try {
                    // Send initial state
                    socket.emit('quickclips_state', {
                        state: 'starting',
                        message: 'Starting quick clips processing...',
                        progress: 5
                    });

                    // Validate inputs
                    if (!data?.fileUri?.trim()) {
                        throw new Error('File URI is required');
                    }
                    if (!data.mimeType?.trim()) {
                        throw new Error('MIME type is required');
                    }
                    if (!data.projectId?.trim()) {
                        throw new Error('Project ID is required');
                    }

                    // Extract object key from GCS URI
                    const gsUri = data.fileUri;
                    if (!gsUri.startsWith('gs://')) {
                        throw new Error('Invalid GCS URI format');
                    }

                    // Get user ID from socket data (set during authentication)
                    const { data: profile, error: profileError } = await supabase
                        .from('users')
                        .select('id')
                        .eq('auth_id', socket.data.user.id)
                        .single();

                    if (profileError || !profile) {
                        console.error('Profile lookup failed for auth_id=', socket.data.user.id, profileError);
                        throw new Error('Could not find user profile');
                    }

                    // Queue the job for processing
                    const jobId = await queueQuickclipsJob(
                        data.projectId,
                        data.fileUri,
                        data.mimeType,
                        data.contentType || 'talking_video',
                        data.targetDuration || 60,
                        profile.id
                    );

                    console.log(`[WebSocket] QuickClips job ${jobId} queued for processing`);

                    // Job is now queued and will be processed by the quickclipsProcessor service
                    // The service will handle all state updates and final response through the project's processing_status

                } catch (error) {
                    console.error('=== QUICKCLIPS PROCESS FAILED ===');
                    console.error('Error details:', error);

                    socket.emit('quickclips_state', {
                        state: 'error',
                        message: error instanceof Error ? error.message : 'An unknown error occurred',
                        progress: 0
                    });

                    socket.emit('quickclips_response', {
                        success: false,
                        error: error instanceof Error ? error.message : 'An unknown error occurred'
                    });
                }
            });

            socket.on('disconnect', () => {
                console.log(`[WebSocket] Client disconnected: ${socket.id}`);
            });
        });

        console.log('[WebSocket] ✓ WebSocket setup completed successfully');
        return io;

    } catch (error) {
        console.error('[WebSocket] FATAL ERROR during WebSocket setup:', error);
        console.error('[WebSocket] Error details:', {
            message: error instanceof Error ? error.message : 'Unknown error',
            name: error instanceof Error ? error.name : 'Unknown',
            stack: error instanceof Error ? error.stack : 'No stack trace'
        });
        
        // Re-throw the error so the server knows there's a problem
        throw new Error(`WebSocket setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}; 