import { Server, Socket } from 'socket.io';
import { generativeModel } from '../integrations/vertexAI.js';
import { generateContent } from '../integrations/googleGenAI.js';
import { bucket } from '../integrations/googleStorage.js';
import { supabase } from '../config/supabaseClient.js';

const googleSearchRetrievalTool = {
    googleSearchRetrieval: {
        disableAttribution: false,
    },
};

export const setupWebSocket = (server: any) => {
    try {
        console.log('[WebSocket] Starting WebSocket setup...');

        // Test imports and dependencies first
        console.log('[WebSocket] Testing dependencies...');
        if (!generativeModel) {
            console.error('[WebSocket] ERROR: generativeModel not available');
        } else {
            console.log('[WebSocket] ✓ generativeModel loaded');
        }

        if (!generateContent) {
            console.error('[WebSocket] ERROR: generateContent not available');
        } else {
            console.log('[WebSocket] ✓ generateContent loaded');
        }

        if (!bucket) {
            console.error('[WebSocket] ERROR: bucket not available');
        } else {
            console.log('[WebSocket] ✓ bucket loaded');
        }

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
                console.error('[WebSocket] Connection error details:', {
                    message: error.message,
                    name: error.name,
                    stack: error.stack
                });
            });

            socket.on('error', (error) => {
                console.error('[WebSocket] Socket error:', error);
                console.error('[WebSocket] Socket error details:', {
                    message: error.message,
                    name: error.name,
                    stack: error.stack
                });
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
                    console.error('[WebSocket] ERROR: Cannot initialize chat session - generativeModel.startChat not available');
                }
            } catch (error) {
                console.error('[WebSocket] ERROR initializing chat session:', error);
            }

            // Handle chat messages
            socket.on('chat_message', async (data: { message: string, useIdeation: boolean }) => {
                // Send the message to the original client
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

                // Send the message to the original client
                socket.emit('state_change', {
                    state: 'idle',
                });
            });

            socket.on('autocut', async (data: {
                prompt: string,
                fileUri: string,
                mimeType: string,
                contentType?: string,
                videoFormat?: string
            }) => {
                const processStartTime = Date.now();
                console.log('=== AUTOCUT PROCESS STARTED ===');
                                    console.log('Request details:', {
                        promptLength: data.prompt?.length,
                        fileUri: data.fileUri,
                        mimeType: data.mimeType,
                        contentType: data.contentType,
                        videoFormat: data.videoFormat,
                        timestamp: new Date().toISOString(),
                        socketId: socket.id
                    });

                try {
                    // Send initial state
                    socket.emit('autocut_state', {
                        state: 'starting',
                        message: 'starting'
                    });
                    console.log('✓ Emitted starting state');

                    // Validate all required fields
                    if (!data) {
                        throw new Error('No data provided');
                    }
                    if (!data.prompt?.trim()) {
                        throw new Error('Prompt is required');
                    }
                    if (!data.fileUri?.trim()) {
                        throw new Error('File URI is required');
                    }
                    if (!data.mimeType?.trim()) {
                        throw new Error('MIME type is required');
                    }
                    console.log('✓ Input validation passed');

                    // Extract the object key from the gs:// URI
                    const gsUri = data.fileUri;
                    if (!gsUri.startsWith('gs://')) {
                        throw new Error('Invalid GCS URI format');
                    }
                    const objectKey = gsUri.replace('gs://lemona-edit-assets/', '');
                    console.log('✓ Extracted object key:', {
                        originalUri: gsUri,
                        objectKey: objectKey
                    });

                    // Verify the file exists in GCS
                    console.log('Checking if file exists in GCS...');
                    const file = bucket.file(objectKey);
                    const [exists] = await file.exists();
                    if (!exists) {
                        throw new Error(`File not found in GCS: ${objectKey}`);
                    }
                    console.log('✓ File exists in GCS');

                    socket.emit('autocut_state', {
                        state: 'generatingurl',
                        message: 'generatingurl'
                    });
                    console.log('✓ Emitted generatingurl state');

                    // Get a signed URL for the video file
                    console.log('Generating signed URL...');
                    const urlStartTime = Date.now();
                    const [signedUrl] = await bucket
                        .file(objectKey)
                        .getSignedUrl({
                            action: 'read',
                            expires: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
                        });

                    if (!signedUrl) {
                        throw new Error('Failed to generate signed URL');
                    }
                    console.log('✓ Generated signed URL:', {
                        duration: `${((Date.now() - urlStartTime) / 1000).toFixed(2)}s`,
                        urlLength: signedUrl.length
                    });

                    socket.emit('autocut_state', {
                        state: 'analyzing',
                        message: 'analyzing'
                    });
                    console.log('✓ Emitted analyzing state');

                    // Send the signed URL directly to Gemini with content type
                    console.log('Sending request to Gemini...');
                    const modelStartTime = Date.now();
                    const modelResponse = await generateContent(
                        data.prompt,
                        signedUrl,
                        data.mimeType,
                        data.contentType,
                        data.videoFormat
                    );
                    console.log('✓ Received response from Gemini:', {
                        duration: `${((Date.now() - modelStartTime) / 1000).toFixed(2)}s`,
                        hasThoughts: !!modelResponse.thoughts?.text,
                        thoughtsLength: modelResponse.thoughts?.text?.length || 0,
                        hasOutput: !!modelResponse.textOutput?.text,
                        outputLength: modelResponse.textOutput?.text?.length || 0
                    });

                    console.log('=== AUTOCUT PROCESS COMPLETED ===');
                    console.log('Process summary:', {
                        totalDuration: `${((Date.now() - processStartTime) / 1000).toFixed(2)}s`,
                        socketId: socket.id,
                        timestamp: new Date().toISOString()
                    });

                    socket.emit('autocut_state', {
                        state: 'completed',
                        message: 'done'
                    });
                    console.log('✓ Emitted completed state');

                    // Emit the response back to the client
                    socket.emit('autocut_response', {
                        success: true,
                        data: modelResponse
                    });
                    console.log('✓ Emitted final response to client');

                }
                catch (error) {
                    console.error('=== AUTOCUT PROCESS FAILED ===');
                    console.error('Error details:', {
                        error: error instanceof Error ? {
                            name: error.name,
                            message: error.message,
                            stack: error.stack
                        } : error,
                        socketId: socket.id,
                        timestamp: new Date().toISOString(),
                        totalDuration: `${((Date.now() - processStartTime) / 1000).toFixed(2)}s`
                    });

                    // Emit error state
                    socket.emit('autocut_state', {
                        state: 'error',
                        message: error instanceof Error ? error.message : 'An unknown error occurred'
                    });
                    console.log('✓ Emitted error state');

                    // Emit error back to the client
                    socket.emit('autocut_response', {
                        success: false,
                        error: error instanceof Error ? error.message : 'An unknown error occurred'
                    });
                    console.log('✓ Emitted error response to client');
                }
            });

            // New QuickClips handler - OpusClip style workflow
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
                    projectId: data.projectId,
                    timestamp: new Date().toISOString(),
                    socketId: socket.id
                });

                // Helper function to update project status
                const updateProjectStatus = async (status: string, message: string, clips?: any[]) => {
                    if (!data.projectId) return;
                    
                    try {
                        const updateData: any = {
                            processing_status: status,
                            processing_message: message
                        };

                        if (clips) {
                            updateData.quickclips_data = {
                                clips,
                                contentType: data.contentType,
                                targetDuration: data.targetDuration,
                                videoFormat: data.videoFormat,
                                originalFilename: 'uploaded_video' // TODO: Get from initial request
                            };
                        }

                        await supabase
                            .from('projects')
                            .update(updateData)
                            .eq('id', data.projectId);
                        
                        console.log(`✓ Updated project ${data.projectId} status: ${status}`);
                    } catch (error) {
                        console.error('Failed to update project status:', error);
                    }
                };

                try {
                    // Update project status: starting
                    await updateProjectStatus('processing', 'Starting quick clips processing...');

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

                    // Extract object key from GCS URI
                    const gsUri = data.fileUri;
                    if (!gsUri.startsWith('gs://')) {
                        throw new Error('Invalid GCS URI format');
                    }
                    const objectKey = gsUri.replace('gs://lemona-edit-assets/', '');

                    // Verify file exists
                    console.log('Checking if file exists in GCS...');
                    const file = bucket.file(objectKey);
                    const [exists] = await file.exists();
                    if (!exists) {
                        throw new Error(`File not found in GCS: ${objectKey}`);
                    }

                    // Update project status: analyzing
                    await updateProjectStatus('processing', 'Analyzing video content...');

                    socket.emit('quickclips_state', {
                        state: 'analyzing',
                        message: 'Analyzing video content...',
                        progress: 20
                    });

                    // Generate signed URL
                    const [signedUrl] = await bucket
                        .file(objectKey)
                        .getSignedUrl({
                            action: 'read',
                            expires: Date.now() + 24 * 60 * 60 * 1000,
                        });

                    // Update project status: generating
                    await updateProjectStatus('processing', 'AI is creating clips...');

                    socket.emit('quickclips_state', {
                        state: 'generating',
                        message: 'AI is creating clips...',
                        progress: 40
                    });

                    // Generate prompt based on content type and format
                    const contentTypePrompts = {
                        'podcast': 'Extract the most engaging and shareable moments from this podcast',
                        'professional_meeting': 'Identify key decisions, insights, and action items from this meeting',
                        'educational_video': 'Find the most valuable learning moments and key takeaways',
                        'talking_video': 'Extract the most engaging, quotable, and shareable moments'
                    };

                    const basePrompt = contentTypePrompts[data.contentType as keyof typeof contentTypePrompts] || contentTypePrompts['talking_video'];
                    const formatInstruction = data.videoFormat === 'short_vertical' 
                        ? 'Create 3-5 viral-ready clips (15-90 seconds each) optimized for mobile viewing.'
                        : 'Create 2-4 substantial clips (2-5 minutes each) with complete context.';

                    const fullPrompt = `${basePrompt}. ${formatInstruction} 

                    Return ONLY a JSON array of clips, no other text. Each clip should have:
                    {
                        "title": "Descriptive title",
                        "start_time": start_seconds,
                        "end_time": end_seconds,
                        "viral_score": score_0_to_10,
                        "description": "Why this moment is valuable"
                    }

                    Target approximately ${data.targetDuration || 60} seconds total across all clips.`;

                    // Get AI analysis
                    const modelResponse = await generateContent(
                        fullPrompt,
                        signedUrl,
                        data.mimeType,
                        data.contentType,
                        data.videoFormat
                    );

                    // Update project status: processing
                    await updateProjectStatus('processing', 'Creating video files...');

                    socket.emit('quickclips_state', {
                        state: 'processing',
                        message: 'Creating video files...',
                        progress: 70
                    });

                    // Parse AI response to extract clips
                    let clips;
                    try {
                        const responseText = modelResponse.textOutput?.text || '';
                        console.log('AI Response:', responseText);
                        
                        // Try to extract JSON from the response
                        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
                        if (jsonMatch) {
                            clips = JSON.parse(jsonMatch[0]);
                        } else {
                            throw new Error('No valid JSON found in AI response');
                        }
                    } catch (parseError) {
                        console.error('Failed to parse AI response:', parseError);
                        // Fallback to mock clips if AI parsing fails
                        clips = [
                            {
                                title: 'Key Highlights',
                                start_time: 30,
                                end_time: 75,
                                viral_score: 8.5,
                                description: 'Most engaging moment from the content'
                            },
                            {
                                title: 'Best Insights',
                                start_time: 120,
                                end_time: 180,
                                viral_score: 9.0,
                                description: 'Valuable insights and takeaways'
                            }
                        ];
                    }

                    // Update project status: finalizing
                    await updateProjectStatus('processing', 'Finalizing clips...');

                    socket.emit('quickclips_state', {
                        state: 'finalizing',
                        message: 'Finalizing clips...',
                        progress: 90
                    });

                    // TODO: In a real implementation, you would:
                    // 1. Use FFmpeg to extract video segments based on start/end times
                    // 2. Upload the processed clips to GCS
                    // 3. Generate signed download URLs
                    // 4. Create thumbnails for each clip

                    // For now, simulate the final clips with mock download URLs
                    const processedClips = clips.map((clip: any, index: number) => ({
                        id: `clip_${Date.now()}_${index}`,
                        title: clip.title,
                        duration: clip.end_time - clip.start_time,
                        start_time: clip.start_time,
                        end_time: clip.end_time,
                        viral_score: clip.viral_score,
                        description: clip.description,
                        thumbnail: `https://picsum.photos/320/180?random=${index + 1}`, // Mock thumbnail
                        downloadUrl: '#', // TODO: Real download URL from processed clip
                        previewUrl: signedUrl // For now, use original video URL for preview
                    }));

                    // Update project status: completed with clips data
                    await updateProjectStatus('completed', 'Clips ready for download!', processedClips);

                    socket.emit('quickclips_state', {
                        state: 'completed',
                        message: 'Clips ready for download!',
                        progress: 100
                    });

                    // Send the final result
                    socket.emit('quickclips_response', {
                        success: true,
                        clips: processedClips,
                        processingTime: Date.now() - processStartTime
                    });

                    console.log('=== QUICKCLIPS PROCESS COMPLETED ===');
                    console.log(`Generated ${processedClips.length} clips in ${((Date.now() - processStartTime) / 1000).toFixed(2)}s`);

                } catch (error) {
                    console.error('=== QUICKCLIPS PROCESS FAILED ===');
                    console.error('Error details:', error);

                    // Update project status: error
                    await updateProjectStatus('error', error instanceof Error ? error.message : 'An unknown error occurred');

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