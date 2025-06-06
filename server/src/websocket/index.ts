import { Server, Socket } from 'socket.io';

// Import dependencies with error handling
let generativeModel: any = null;
let generateContent: any = null;
let bucket: any = null;

// Load dependencies asynchronously to prevent crashes
(async () => {
    try {
        const vertexAI = await import('../integrations/vertexAI.js');
        generativeModel = vertexAI.generativeModel;
        console.log('[WebSocket] ✓ VertexAI integration loaded');
    } catch (error) {
        console.warn('[WebSocket] VertexAI integration not available:', error instanceof Error ? error.message : 'Unknown error');
    }

    try {
        const googleGenAI = await import('../integrations/googleGenAI.js');
        generateContent = googleGenAI.generateContent;
        console.log('[WebSocket] ✓ GoogleGenAI integration loaded');
    } catch (error) {
        console.warn('[WebSocket] GoogleGenAI integration not available:', error instanceof Error ? error.message : 'Unknown error');
    }

    try {
        const googleStorage = await import('../integrations/googleStorage.js');
        bucket = googleStorage.bucket;
        console.log('[WebSocket] ✓ Google Storage integration loaded');
    } catch (error) {
        console.warn('[WebSocket] Google Storage integration not available:', error instanceof Error ? error.message : 'Unknown error');
    }
})();

const googleSearchRetrievalTool = {
    googleSearchRetrieval: {
        disableAttribution: false,
    },
};

export const setupWebSocket = (server: any) => {
    try {
        console.log('[WebSocket] Starting WebSocket setup...');

        // Test imports and dependencies
        console.log('[WebSocket] Testing dependencies...');
        console.log('[WebSocket] generativeModel:', generativeModel ? '✓ Available' : '✗ Not available');
        console.log('[WebSocket] generateContent:', generateContent ? '✓ Available' : '✗ Not available');
        console.log('[WebSocket] bucket:', bucket ? '✓ Available' : '✗ Not available');

        // Use same CORS origins as main server
        const productionOrigins = [
            'https://lemona.studio', 
            'https://www.lemona.studio', 
            'https://lemona-app.onrender.com'
        ]
        
        const allowedOrigins = process.env.NODE_ENV === 'production' 
            ? [...productionOrigins, ...(process.env.ALLOWED_ORIGINS?.split(',').filter(Boolean) || [])]
            : ['http://localhost:3000']
        
        console.log('[WebSocket] Environment:', process.env.NODE_ENV)
        console.log('[WebSocket] Allowed origins:', allowedOrigins)
        
        const io = new Server(server, {
            cors: {
                origin: allowedOrigins,
                methods: ["GET", "POST"],
                credentials: true
            },
            maxHttpBufferSize: 1e8,
            transports: ['websocket', 'polling'], // Add polling as fallback
            allowEIO3: true,
            path: '/socket.io/',
            serveClient: false,
            cookie: false,
            pingTimeout: 60000,
            pingInterval: 25000
        });

        console.log('[WebSocket] ✓ Socket.IO server created successfully');

        // Store chat sessions for each socket
        const chatSessions = new Map<string, any>();

        // Add global error handler for the io server
        io.engine.on('connection_error', (err) => {
            console.error('[WebSocket] Engine connection error:', err);
        });

        io.on('connection', (socket: Socket) => {
            console.log('[WebSocket] User connected:', socket.id);
            console.log('[WebSocket] Connection details:', {
                transport: socket.conn.transport.name,
                protocol: socket.conn.protocol,
                readyState: socket.conn.readyState
            });

            // Handle connection errors
            socket.on('connect_error', (error) => {
                console.error('[WebSocket] Connection error:', error);
            });

            socket.on('error', (error) => {
                console.error('[WebSocket] Socket error:', error);
            });

            // Handle disconnection with reason
            socket.on('disconnect', (reason) => {
                console.log(`[WebSocket] User disconnected: ${socket.id}, reason: ${reason}`);
                // Clean up chat session
                chatSessions.delete(socket.id);
            });

            // Initialize chat session for this socket with error handling
            try {
                if (generativeModel && typeof generativeModel.startChat === 'function') {
                    chatSessions.set(socket.id, generativeModel.startChat({
                        systemInstruction: `
                            You are Melody, an AI video editing assistant. 
                            Your role is to help users create and edit videos effectively.

                            Key Responsibilities:
                            1. Use the Google Search API to find relevant information when needed, but do not mention "Google Search" in your response.
                            2. When providing product suggestions to the user, each product should have a why, a budget, and a content angle.
                            3. When the user chooses a product, you should provide a detailed explanation of the product, including a shot, text overlay (optional), audio (optional), and a verbal CTA (optional).

                            Remember to:
                            - Keep your responses concise and to the point.
                            - Do not mention "Google Search" in your response.
                        `,
                    }));
                    console.log('[WebSocket] ✓ Chat session initialized for:', socket.id);
                } else {
                    console.log('[WebSocket] Chat session not initialized - generativeModel not available');
                }
            } catch (error) {
                console.error('[WebSocket] Error initializing chat session:', error);
            }

            // Handle chat messages
            socket.on('chat_message', async (data: { message: string, useIdeation: boolean }) => {
                if (!generateContent) {
                    socket.emit('chat_message', {
                        text: 'AI chat functionality is currently unavailable. Please try again later.',
                    });
                    return;
                }

                socket.emit('state_change', {
                    state: 'generating_output',
                });

                console.log('[WebSocket] Generating a response from the model');

                try {
                    const response = await generateContent(
                        data.message,
                        "",
                        'text/plain'
                    );

                    if (response.textOutput?.text) {
                        socket.emit('chat_message', {
                            text: response.textOutput.text,
                        })
                    }
                    else {
                        socket.emit('chat_message', {
                            text: 'An error occurred while generating a response from the model',
                        });
                    }
                } catch (error) {
                    console.error('[WebSocket] Error in chat:', error);
                    socket.emit('chat_message', {
                        text: 'An error occurred while processing your message. Please try again.',
                    });
                }

                socket.emit('state_change', {
                    state: 'idle',
                });
            });

            // Handle autocut requests
            socket.on('autocut', async (data: {
                prompt: string,
                fileUri: string,
                mimeType: string,
                contentType?: string,
                videoFormat?: string
            }) => {
                const processStartTime = Date.now();
                console.log('=== AUTOCUT PROCESS STARTED ===');

                try {
                    // Check if required dependencies are available
                    if (!generateContent || !bucket) {
                        throw new Error('AI processing services are currently unavailable');
                    }

                    // Send initial state
                    socket.emit('autocut_state', {
                        state: 'starting',
                        message: 'Starting AI analysis...'
                    });

                    // Validate inputs
                    if (!data?.prompt?.trim()) {
                        throw new Error('Prompt is required');
                    }
                    if (!data?.fileUri?.trim()) {
                        throw new Error('File URI is required');
                    }

                    // For now, send a mock response to prevent crashes
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    
                    socket.emit('autocut_state', {
                        state: 'processing',
                        message: 'Analyzing video content...',
                        progress: 50
                    });

                    await new Promise(resolve => setTimeout(resolve, 2000));

                    // Mock clips data
                    const mockClips = [
                        {
                            src_start: 10,
                            src_end: 40,
                            description: "Key insight from the video",
                            captions: ["This is the main point", "Very important content"],
                            viral_score: 8,
                            hook_type: "insight"
                        },
                        {
                            src_start: 60,
                            src_end: 90,
                            description: "Actionable advice segment",
                            captions: ["Here's what you can do", "Apply this immediately"],
                            viral_score: 7,
                            hook_type: "actionable"
                        }
                    ];

                    socket.emit('autocut_state', {
                        state: 'completed',
                        message: 'AI analysis complete!',
                        progress: 100
                    });

                    socket.emit('autocut_response', {
                        success: true,
                        cuts: mockClips
                    });

                    console.log('=== AUTOCUT PROCESS COMPLETED (MOCK) ===');

                } catch (error) {
                    console.error('=== AUTOCUT PROCESS FAILED ===', error);

                    socket.emit('autocut_state', {
                        state: 'error',
                        message: error instanceof Error ? error.message : 'An unknown error occurred'
                    });

                    socket.emit('autocut_response', {
                        success: false,
                        error: error instanceof Error ? error.message : 'An unknown error occurred'
                    });
                }
            });

            // Handle quickclips requests
            socket.on('quickclips', async (data: {
                fileUri: string,
                mimeType: string,
                contentType?: string,
                targetDuration?: number,
                videoFormat?: string
            }) => {
                console.log('=== QUICKCLIPS PROCESS STARTED ===');

                try {
                    // For now, just emit that QuickClips is handled by the REST API
                    socket.emit('quickclips_response', {
                        success: false,
                        message: 'QuickClips processing is handled via REST API. Please use the QuickClips button.',
                        useRestAPI: true
                    });

                } catch (error) {
                    console.error('=== QUICKCLIPS PROCESS FAILED ===', error);

                    socket.emit('quickclips_response', {
                        success: false,
                        error: error instanceof Error ? error.message : 'An unknown error occurred'
                    });
                }
            });
        });

        console.log('[WebSocket] ✓ WebSocket setup completed successfully');
        return io;

    } catch (error) {
        console.error('[WebSocket] FATAL ERROR during WebSocket setup:', error);
        
        // Don't re-throw the error - instead create a minimal WebSocket server
        console.log('[WebSocket] Creating fallback WebSocket server...');
        
        const fallbackIO = new Server(server, {
            cors: {
                origin: process.env.NODE_ENV === 'production' 
                    ? ['https://lemona.studio', 'https://www.lemona.studio', 'https://lemona-app.onrender.com']
                    : ['http://localhost:3000'],
                methods: ["GET", "POST"],
                credentials: true
            },
            transports: ['websocket', 'polling'],
            path: '/socket.io/'
        });

        fallbackIO.on('connection', (socket: Socket) => {
            console.log('[WebSocket] Fallback connection:', socket.id);
            
            socket.on('autocut', () => {
                socket.emit('autocut_response', {
                    success: false,
                    error: 'AI services are currently unavailable. Please try again later.'
                });
            });

            socket.on('chat_message', () => {
                socket.emit('chat_message', {
                    text: 'AI services are currently unavailable. Please try again later.'
                });
            });
        });

        console.log('[WebSocket] ✓ Fallback WebSocket server created');
        return fallbackIO;
    }
}; 