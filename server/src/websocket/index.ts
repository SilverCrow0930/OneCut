import { Server, Socket } from 'socket.io';
import { generativeModel } from '../integrations/vertexAI.js';
import { generateContent, generateAIAssistantResponse } from '../integrations/googleGenAI.js';
import { bucket as gcsStorageBucket } from '../integrations/googleStorage.js';
import { Server as HttpServer } from 'http';
import { Storage } from '@google-cloud/storage';
import { supabase } from '../config/supabaseClient.js';
import { createServer } from 'http'
import cors from 'cors'
import type { Application } from 'express'
import { queueSmartCutJob } from '../services/smartcutProcessor.js'

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

export const setupWebSocket = async (app: Application) => {
    // Create HTTP server
    const server = createServer(app)
    
    // Create Socket.IO server with CORS support
    const io = new Server(server, {
        cors: {
            origin: process.env.NODE_ENV === 'production' 
                ? [process.env.CLIENT_URL || 'https://lemona.ai'] 
                : ["http://localhost:3000", "http://127.0.0.1:3000"],
            methods: ["GET", "POST"],
            credentials: true
        },
        path: '/socket.io/',
        transports: ['websocket', 'polling'],
        allowEIO3: true
    })

    // Store io instance globally for use in processors
    global.io = io

    // Connection handling
    console.log('Setting up Socket.IO event handlers...')
    
    try {
        // Connection event
        io.on('connection', (socket: SocketIoSocket) => {
            console.log(`[WebSocket] Client connected: ${socket.id}`)
            
            // Send welcome message
            socket.emit('connection_status', {
                status: 'connected',
                message: 'Connected to Lemona WebSocket server',
                timestamp: new Date().toISOString()
            })

            // Autocut handler - legacy support
            socket.on('autocut', async (data: {
                prompt: string,
                fileUri: string,
                mimeType: string,
                contentType?: string,
                videoFormat?: string,
                targetDuration?: number
            }) => {
                console.log('[WebSocket] Legacy autocut request received, redirecting to smartcut')
                socket.emit('smartcut', data)
            })

            // Smart Cut handler
            socket.on('smartcut', async (data: {
                fileUri: string,
                mimeType: string,
                contentType?: string,
                targetDuration?: number,
                videoFormat?: string,
                projectId?: string
            }) => {
                const processStartTime = Date.now();
                console.log('=== SMART CUT PROCESS STARTED ===');
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
                    // Emit initial state
                    socket.emit('smartcut_state', {
                        state: 'starting',
                        message: 'Starting Smart Cut processing...',
                        progress: 0
                    });

                    // TODO: Get authenticated user ID from socket auth
                    const userId = socket.handshake.auth?.userId || 'anonymous'
                    const projectId = data.projectId || 'temp-project'

                    // Queue the job through the processor
                    const jobId = await queueSmartCutJob(
                        projectId,
                        data.fileUri,
                        data.mimeType,
                        data.contentType || 'talking_video',
                        data.targetDuration || 60,
                        userId
                    )

                    console.log(`[WebSocket] Smart Cut job ${jobId} queued for processing`)

                    // Job is now queued and will be processed by the smartcutProcessor service
                    // The processor will emit progress updates via the global io instance

                } catch (error) {
                    console.error('=== SMART CUT PROCESS FAILED ===');
                    console.error('Error details:', error);
                    
                    socket.emit('smartcut_state', {
                        state: 'error',
                        message: 'Processing failed',
                        progress: 0
                    });

                    socket.emit('smartcut_response', {
                        success: false,
                        error: error instanceof Error ? error.message : 'Unknown error occurred'
                    });
                }
            })

            // Disconnect handler
            socket.on('disconnect', (reason) => {
                console.log(`[WebSocket] Client disconnected: ${socket.id}, reason: ${reason}`)
            })
        })

        return { server, io }
    } catch (error) {
        console.error('[WebSocket] Setup failed:', error)
        throw error
    }
}

// Export interface for Socket.IO socket type
interface SocketIoSocket {
    id: string
    emit: (event: string, data: any) => void
    on: (event: string, handler: (data: any) => void) => void
    handshake: {
        auth?: {
            userId?: string
            token?: string
        }
    }
} 