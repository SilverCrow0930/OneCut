import {
    GoogleGenAI,
    createUserContent,
    createPartFromUri,
} from '@google/genai'

if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set')
}

if (!process.env.GOOGLE_CLOUD_PROJECT) {
    throw new Error('GOOGLE_CLOUD_PROJECT is not set')
}

if (!process.env.GOOGLE_CLOUD_LOCATION) {
    throw new Error('GOOGLE_CLOUD_LOCATION is not set')
}

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
})

const model = "gemini-2.5-flash-preview-05-20"

const systemInstruction = `
    You are a video editor.
    Given a prompt and a video, you will make cuts to the video to create a short video clip of 40 to 90 seconds.
    Each cut should be of the format { src_start: number, src_end: number, description: string, captions: string[] }
    The src_start and src_end should be the start and end of the clip in milliseconds.
    The description should be a short justification for the cut.
    The captions should be a list of captions for the clip.
    Each caption should be at most 6 words.

`

const waitForFileActive = async (fileId: string, delayMs = 5000) => {
    let attempt = 0;
    let lastState: string | undefined = '';
    let consecutiveSameState = 0;
    const maxConsecutiveSameState = 60; // Increased to 5 minutes of same state (60 * 5000ms)
    const maxAttempts = 360; // 30 minutes total wait time (360 * 5000ms)

    while (attempt < maxAttempts) {
        attempt++;
        const file = await ai.files.get({ name: fileId });
        const currentState = file.state || 'STATE_UNSPECIFIED';

        // Track consecutive same states to detect potential issues
        if (currentState === lastState) {
            consecutiveSameState++;
        } else {
            consecutiveSameState = 1;
            lastState = currentState;
        }

        console.log(`File status check attempt ${attempt}:`, {
            state: currentState,
            error: file.error,
            mimeType: file.mimeType,
            attempt: attempt,
            totalWaitTime: `${(attempt * delayMs / 1000).toFixed(1)}s`,
            consecutiveSameState: consecutiveSameState
        });

        if (currentState === 'ACTIVE') {
            console.log(`File is now active and ready for processing after ${attempt} attempts (${(attempt * delayMs / 1000).toFixed(1)}s)`);
            return true;
        }

        if (currentState === 'FAILED') {
            throw new Error(`File processing failed: ${file.error?.message || 'Unknown error'}`);
        }

        if (currentState === 'PROCESSING' || currentState === 'STATE_UNSPECIFIED') {
            // If we've been in the same state for too long, just log a warning but continue
            if (consecutiveSameState > maxConsecutiveSameState) {
                console.warn(`File has been in ${currentState} state for ${consecutiveSameState} consecutive attempts (${(consecutiveSameState * delayMs / 1000).toFixed(1)}s). Continuing to wait...`);
            }

            console.log(`File is still ${currentState.toLowerCase()}, waiting ${delayMs}ms before next attempt...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
            continue;
        }

        throw new Error(`Unexpected file state: ${currentState}`);
    }

    throw new Error(`File processing timed out after ${maxAttempts} attempts (${(maxAttempts * delayMs / 1000).toFixed(1)}s)`);
}

export const generateContent = async (prompt: string, signedUrl: string, mimeType: string) => {
    console.log('=== GOOGLE GENAI CONTENT GENERATION STARTED ===');
    console.log('Input parameters:', {
        promptLength: prompt.length,
        mimeType,
        signedUrlLength: signedUrl.length
    });

    try {
        // Download the video file
        console.log('Starting video file download...');
        const controller = new AbortController();
        const fileResponse = await fetch(signedUrl, {
            signal: controller.signal,
        });

        if (!fileResponse.ok) {
            console.error('Download failed:', {
                status: fileResponse.status,
                statusText: fileResponse.statusText,
                headers: Object.fromEntries(fileResponse.headers.entries())
            });
            throw new Error(`Failed to download video file: ${fileResponse.status} ${fileResponse.statusText}`);
        }

        console.log('Download successful, reading file buffer...');
        const buffer = await Promise.race([
            fileResponse.arrayBuffer(),
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Buffer read timeout')), 24 * 60 * 60 * 1000)
            )
        ]) as ArrayBuffer;

        console.log('File details:', {
            sizeBytes: buffer.byteLength,
            sizeMB: (buffer.byteLength / (1024 * 1024)).toFixed(2),
            mimeType
        });

        if (buffer.byteLength === 0) {
            throw new Error('Video file is empty');
        }

        const blob = new Blob([buffer], { type: mimeType });
        console.log('Blob created:', {
            size: blob.size,
            type: blob.type
        });

        // Upload the file to Google GenAI
        console.log('Initiating file upload to Google GenAI...');
        const uploadStartTime = Date.now();
        const uploadPromise = ai.files.upload({
            file: blob,
            config: { mimeType: mimeType }
        });

        const uploadedFile = await Promise.race([
            uploadPromise,
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('File upload timeout')), 24 * 60 * 60 * 1000)
            )
        ]);

        console.log('File upload completed:', {
            duration: `${((Date.now() - uploadStartTime) / 1000).toFixed(2)}s`,
            fileUri: uploadedFile.uri,
            fileName: uploadedFile.name
        });

        if (!uploadedFile.uri) {
            throw new Error('Failed to upload file to Google GenAI');
        }

        if (!uploadedFile.name) {
            throw new Error('File name not returned from upload');
        }

        console.log('Waiting for file to become active...');
        try {
            await waitForFileActive(uploadedFile.name);
            console.log('File is now active, proceeding with content generation');
        } catch (error) {
            console.error('Error waiting for file to become active:', {
                error: error instanceof Error ? {
                    name: error.name,
                    message: error.message,
                    stack: error.stack
                } : error
            });
            throw new Error(`Video processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        const content = createUserContent([
            prompt,
            createPartFromUri(uploadedFile.uri, mimeType)
        ]);

        console.log('Sending content to model for analysis...');
        const modelStartTime = Date.now();
        const modelResponse = await Promise.race([
            ai.models.generateContent({
                model: model,
                contents: [content],
                config: {
                    systemInstruction: systemInstruction,
                    thinkingConfig: {
                        includeThoughts: true,
                    },
                    maxOutputTokens: 8192,
                    temperature: 0.7,
                    topP: 0.8,
                    topK: 40,
                },
            }).catch((error) => {
                console.error('Gemini API error details:', {
                    message: error.message,
                    status: error.status,
                    code: error.code,
                    details: error.details,
                    stack: error.stack
                });
                
                // Provide more specific error messages
                if (error.message?.includes('503') || error.status === 503) {
                    throw new Error('got status: 503 Service Unavailable. The AI service is temporarily overloaded. Please try again in a few minutes.');
                } else if (error.message?.includes('quota') || error.message?.includes('limit')) {
                    throw new Error('API quota or rate limit exceeded. Please try again later.');
                } else if (error.message?.includes('timeout')) {
                    throw new Error('Request timed out. Please try with a shorter video.');
                } else {
                    throw error;
                }
            }),
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Model generation timeout after 24 hours')), 24 * 60 * 60 * 1000)
            )
        ]);

        console.log('Model generation completed:', {
            duration: `${((Date.now() - modelStartTime) / 1000).toFixed(2)}s`,
            hasCandidates: !!modelResponse.candidates,
            candidateCount: modelResponse.candidates?.length
        });

        if (!modelResponse.candidates) {
            throw new Error('No candidates found in response')
        }

        if (!modelResponse.candidates?.[0]?.content?.parts) {
            throw new Error('No parts found in response')
        }

        const thoughts = modelResponse.candidates[0].content.parts
            .find(part => part.thought === true)?.text;

        console.log('Model thoughts:', {
            length: thoughts?.length || 0,
            preview: thoughts?.substring(0, 100) + '...'
        });

        const textOutput = modelResponse.candidates[0].content.parts
            .find(part => !('thought' in part))?.text;

        console.log('Model output:', {
            length: textOutput?.length || 0,
            preview: textOutput?.substring(0, 100) + '...'
        });

        // Parse the JSON output from the model
        let cuts: Array<{ src_start: number, src_end: number, description: string, captions: string[] }> = [];
        try {
            // Extract JSON array from the text output
            const jsonMatch = textOutput?.match(/\[\s*\{[\s\S]*\}\s*\]/);
            if (jsonMatch) {
                cuts = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('No valid JSON array found in model output');
            }

            // Validate the cuts array
            if (!Array.isArray(cuts)) {
                throw new Error('Model output is not an array');
            }

            // Validate each cut
            cuts.forEach((cut, index) => {
                if (!cut.src_start || !cut.src_end || !cut.description || !Array.isArray(cut.captions)) {
                    throw new Error(`Invalid cut format at index ${index}`);
                }
            });
        } catch (error) {
            console.error('Failed to parse model output:', error);
            throw new Error(`Failed to parse model output: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        console.log('=== GOOGLE GENAI CONTENT GENERATION COMPLETED ===');
        return {
            thoughts: {
                text: thoughts || ''
            },
            textOutput: {
                text: JSON.stringify(cuts, null, 2)
            }
        }
    }
    catch (error) {
        console.error('=== GOOGLE GENAI CONTENT GENERATION FAILED ===');
        console.error('Error details:', {
            error: error instanceof Error ? {
                name: error.name,
                message: error.message,
                stack: error.stack
            } : error,
            timestamp: new Date().toISOString()
        });
        throw error;
    }
}

// const ans = {
//     "candidates": [{
//         "content": {
//             "parts": [
//                 {
//                     "thought": true,
//                     "text": `
//                         **Analysis of Video Editing Request**\n\nOkay, I understand the task. 
//                         The user wants me to edit a video, specifically to create a 40-60 second clip from it.  
//                         They've given me a very specific format to follow: I need to define the start and end points of each cut, 
//                         write a description of that section, and provide captions for each cut, making sure the sum of all captions equals the video's transcript. 
//                         The goal is to make the final clip interesting, captivating, and engaging, and to avoid using any introduction or conclusion.\n\n
//                         The challenge is that the only \"video\" provided is a snippet, a mere 9-second clip of a stressed man at his laptop (0:00-0:09). 
//                         There's no audio, no transcript, and critically, the video itself, only a timestamp range.  This makes the task *impossible* to fulfill as requested. 
//                         I can't create a 40-60 second video from a 9-second clip!\n\nMy initial thoughts are, \"This is tough!  I'm missing key information.\"  
//                         The prompt specifies \"watch this video,\" so I have to assume I'm supposed to *see* something. 
//                         Given the information and the provided timestamp range, the video exists, but is currently absent.\n\n
//                         I've checked the constraints: I *understand* the format the user wants. I need to make cuts, I need to format the cuts as `src_start`, `src_end`, `description`, and `captions`. 
//                         The user wants me to make sure the captions are at most 5 words, and the sum of the captions represents the transcript. 
//                         If the video was provided and had a transcript I could use the information to achieve these goals.\n\n
//                         Here's my analysis:\n
//                         1.  **Length Requirement:**  I cannot create a clip of the desired length (40-60 seconds) from a 9-second source. This constraint is not met.\n
//                         2.  **Transcript/Captions:**  No audio or transcript is provided, making it impossible to generate accurate captions aligned with the dialogue. This constraint is not met.\n
//                         3.  **Content Engagement:**  The lack of video content or transcript makes it hard to analyze and make an engaging video.\n
//                         4.  **Format:** I *understand* the desired output format, but am unable to execute it fully without the necessary resources.\n\n
//                         In an ideal world, if I *had* the full video (say, a 2-minute video) and a transcript, I would approach this by:\n\n
//                         1.  **Watching the entire video:** I'd get a sense of the narrative, the key points, and the flow.\n
//                         2.  **Identifying Key Moments:** I'd look for visually engaging scenes, moments of tension, resolution, or humor – things that would draw the viewer in.\n
//                         3.  **Structuring the Narrative:** I'd try to craft a mini-story within the 40-60 second timeframe, focusing on a clear beginning, middle, and end, or at least a compelling \"slice of life.\"\n
//                         4.  **Selecting Cuts:** I'd strategically choose start and end points for each cut, considering pacing and flow.\n
//                         5.  **Crafting Descriptions:** I would write concise descriptions to give the viewer a visual context.\n
//                         6.  **Writing Captions:** I'd extract key phrases and translate them into concise captions, keeping within the 5-word limit and aiming for a transcript-like feel.\n\n
//                         **Since I only have a 9-second clip and no transcript,** I'll have to *demonstrate* the output format and *explain* the limitation.  
//                         I will use the full 9-second clip as a single cut, showing how I *would* approach the task *if* I had the real content.\n\n
//                         Here's a sample cut, based on the *assumption* that this 9-second clip is part of a larger video about work stress.\n\n```json\n[\n  {\n    \"src_start\": 0,\n    \"src_end\": 9000,\n    \"description\": \"Opening shot establishing the protagonist's initial struggle and frustration with his work, setting the stage for the rest of the narrative.\",\n    \"captions\": [\n      \"Feeling the pressure\",\n      \"Overwhelmed by work\",\n      \"Stressed and frustrated\"\n    ]\n  }\n]\n```\n\n**Important Note:** *This is not a complete 40-60 second clip.* This example merely shows my *understanding* of the format and the type of *approach* I would take with the real video content.  This is what I *would* do if the full video and audio transcript were provided. Without those, I'm unable to create the finished product`
//                 },
//                 {
//                     "text": "The provided video clip is 9 seconds long (0:00 to 0:09). Unfortunately, I cannot create a video clip of 40 to 60 seconds from a source video that is only 9 seconds long.\n\nTo demonstrate how I would approach this task if a longer video were provided, I will make a cut from the available 9-second clip, assuming it would be part of a larger narrative. Please note that the captions are inferred from the visual content as no transcript was provided for this short clip.\n\nHere is a sample cut based on the provided video:\n\n```json\n[\n  {\n    \"src_start\": 0,\n    \"src_end\": 9000,\n    \"description\": \"This shot captures the man's initial feeling of overwhelm and frustration, setting up a problem that would ideally be resolved later in a longer video. His gestures convey deep stress and exhaustion.\",\n    \"captions\": [\n      \"Overwhelmed by the task\",\n      \"Feeling the pressure\",\n      \"Deep in thought\",\n      \"Struggling to cope\",\n      \"Work stress hits\"\n    ]\n  }\n]\n```"
//                 }
//             ],
//             "role": "model"
//         }, "finishReason": "STOP", "index": 0
//     }],
//     "modelVersion": "models/gemini-2.5-flash-preview-05-20",
//     "usageMetadata": {
//         "promptTokenCount": 2804,
//         "candidatesTokenCount": 254,
//         "totalTokenCount": 4424,
//         "promptTokensDetails": [{
//             "modality": "TEXT",
//             "tokenCount": 174
//         },
//         {
//             "modality": "VIDEO",
//             "tokenCount": 2630
//         }],
//         "thoughtsTokenCount": 1366
//     }
// }