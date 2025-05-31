import { Server, Socket } from 'socket.io';
import { generativeModel } from '../integrations/vertexAI.js';
import { generateContent } from '../integrations/googleGenAI.js';
import { bucket } from '../integrations/googleStorage.js';

const googleSearchRetrievalTool = {
    googleSearchRetrieval: {
        disableAttribution: false,
    },
};

export const setupWebSocket = (server: any) => {
    const io = new Server(server, {
        cors: {
            origin: process.env.FRONTEND_URL || "http://localhost:3000",
            methods: ["GET", "POST"],
            credentials: true
        },
        maxHttpBufferSize: 1e8,
        transports: ['websocket'],
        allowEIO3: true,
        path: '/socket.io/',
        serveClient: false,
        cookie: false
    });

    // Store chat sessions for each socket
    const chatSessions = new Map<string, any>();

    io.on('connection', (socket: Socket) => {
        console.log('a user connected: ' + socket.id);
        console.log('Connection details:', {
            transport: socket.conn.transport.name,
            protocol: socket.conn.protocol,
            readyState: socket.conn.readyState
        });

        // Handle connection errors
        socket.on('connect_error', (error) => {
            console.error('Connection error:', error);
            console.error('Connection error details:', {
                message: error.message,
                name: error.name,
                stack: error.stack
            });
        });

        socket.on('error', (error) => {
            console.error('Socket error:', error);
            console.error('Socket error details:', {
                message: error.message,
                name: error.name,
                stack: error.stack
            });
        });

        // Handle disconnection with reason
        socket.on('disconnect', (reason) => {
            console.log(`User disconnected: ${socket.id}, reason: ${reason}`);
            // Clean up chat session
            chatSessions.delete(socket.id);
        });

        // Initialize chat session for this socket
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

        // Handle chat messages
        socket.on('chat_message', async (data: { message: string, useIdeation: boolean }) => {
            // Send the message to the original client
            socket.emit('state_change', {
                state: 'generating_output',
            });

            console.log('Generating a response from the model');

            try {
                const chat = chatSessions.get(socket.id);
                if (!chat) {
                    throw new Error('Chat session not found');
                }

                // Configure the model based on ideation mode
                const generationConfig = {
                    temperature: 0.7,
                    topP: 0.8,
                    topK: 40,
                    maxOutputTokens: 2048,
                };

                const resp = await chat.sendMessage(data.message, {
                    generationConfig,
                    tools: data.useIdeation ?
                        [googleSearchRetrievalTool] :
                        undefined
                })

                const contentResponse = resp.response;

                console.log('Response from the model: ' + JSON.stringify(contentResponse));

                if (contentResponse.candidates?.[0]?.content.parts[0].text) {
                    socket.emit('chat_message', {
                        text: contentResponse.candidates?.[0]?.content.parts[0].text,
                    });
                }
                else {
                    socket.emit('chat_message', {
                        text: 'An error occurred while generating a response from the model',
                    });
                }
            } catch (error) {
                console.error('Error in chat:', error);
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
            mimeType: string
        }) => {
            const processStartTime = Date.now();
            console.log('=== AUTOCUT PROCESS STARTED ===');
            console.log('Request details:', {
                promptLength: data.prompt?.length,
                fileUri: data.fileUri,
                mimeType: data.mimeType,
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

                // Send the signed URL directly to Gemini
                console.log('Sending request to Gemini...');
                const modelStartTime = Date.now();
                const modelResponse = await generateContent(
                    data.prompt,
                    signedUrl,
                    data.mimeType
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
    });

    return io;
}; 