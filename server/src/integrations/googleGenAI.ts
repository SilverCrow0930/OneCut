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

const systemInstruction = `You are a professional video editor AI assistant.

When given a video, analyze it and create engaging cuts for a highlight reel or short-form content. 
Focus on the most interesting, engaging, or important moments.

Respond with a JSON array of cuts in this simple format:
[
  {
    "start": <start_time_in_seconds>,
    "end": <end_time_in_seconds>, 
    "reason": "<brief explanation of why this moment is interesting>"
  }
]

Keep cuts natural and engaging. Aim for a total duration of 30-90 seconds across all cuts.
Skip any boring introductions or lengthy conclusions.`

const chatSystemInstruction = `You are Melody, an AI video editing assistant.
Your role is to help users create and edit videos effectively.`

const waitForFileActive = async (fileId: string, delayMs = 5000) => {
    let attempt = 0;
    const maxAttempts = 120; // 10 minutes total wait time

    while (attempt < maxAttempts) {
        attempt++;
        const file = await ai.files.get({ name: fileId });
        const currentState = file.state || 'STATE_UNSPECIFIED';

        console.log(`File status check ${attempt}: ${currentState}`);

        if (currentState === 'ACTIVE') {
            console.log(`File is ready after ${attempt} attempts`);
            return true;
        }

        if (currentState === 'FAILED') {
            throw new Error(`File processing failed: ${file.error?.message || 'Unknown error'}`);
        }

        if (currentState === 'PROCESSING' || currentState === 'STATE_UNSPECIFIED') {
            await new Promise(resolve => setTimeout(resolve, delayMs));
            continue;
        }

        throw new Error(`Unexpected file state: ${currentState}`);
    }

    throw new Error(`File processing timed out after ${maxAttempts} attempts`);
}

export const generateContent = async (prompt: string, signedUrl: string, mimeType: string) => {
    // Handle chat requests (no video)
    if (!signedUrl) {
        try {
            const chatResponse = await ai.models.generateContent({
                model: model,
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                config: {
                    systemInstruction: chatSystemInstruction,
                    maxOutputTokens: 2048,
                    temperature: 0.7,
                },
            });

            return {
                thoughts: { text: '' },
                textOutput: { text: chatResponse.candidates?.[0]?.content?.parts?.[0]?.text || 'No response' }
            };
        } catch (error: any) {
            console.error('Chat error:', error);
            throw error;
        }
    }

    console.log('Starting video analysis...');

    try {
        // Download video
        const fileResponse = await fetch(signedUrl);
        if (!fileResponse.ok) {
            throw new Error(`Failed to download video: ${fileResponse.status}`);
        }

        const buffer = await fileResponse.arrayBuffer();
        console.log(`Video size: ${(buffer.byteLength / (1024 * 1024)).toFixed(2)}MB`);

        const blob = new Blob([buffer], { type: mimeType });

        // Upload to Google GenAI
        console.log('Uploading to Google GenAI...');
        const uploadedFile = await ai.files.upload({
            file: blob,
            config: { mimeType: mimeType }
        });

        if (!uploadedFile.uri || !uploadedFile.name) {
            throw new Error('Failed to upload file');
        }

        // Wait for processing
        await waitForFileActive(uploadedFile.name);

        // Generate content
        const content = createUserContent([
            prompt || "Analyze this video and create engaging cuts for a highlight reel.",
            createPartFromUri(uploadedFile.uri, mimeType)
        ]);

        console.log('Analyzing video...');
        const response = await ai.models.generateContent({
            model: model,
            contents: [content],
            config: {
                systemInstruction: systemInstruction,
                maxOutputTokens: 4096,
                temperature: 0.7,
            },
        });

        const textOutput = response.candidates?.[0]?.content?.parts?.find((part: any) => !part.thought)?.text;
        
        if (!textOutput) {
            throw new Error('No response from model');
        }

        // Simple JSON extraction - let it be more flexible
        let cuts = [];
        try {
            // Try to find JSON in the response
            const jsonMatch = textOutput.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                cuts = JSON.parse(jsonMatch[0]);
            } else {
                // If no JSON found, create a simple response
                cuts = [{
                    start: 0,
                    end: 30,
                    reason: "Unable to parse specific cuts, showing first 30 seconds"
                }];
            }
        } catch (parseError) {
            console.warn('Could not parse JSON response, using fallback');
            cuts = [{
                start: 0,
                end: 30,
                reason: "Generated content could not be parsed as JSON"
            }];
        }

        console.log(`Generated ${cuts.length} cuts`);
        
        return {
            thoughts: { text: `Generated ${cuts.length} video cuts` },
            textOutput: { text: JSON.stringify(cuts, null, 2) }
        };

    } catch (error: any) {
        console.error('Video processing error:', error);
        
        // Provide user-friendly error messages
        if (error.message?.includes('503')) {
            throw new Error('AI service is temporarily busy. Please try again in a few minutes.');
        } else if (error.message?.includes('quota') || error.message?.includes('limit')) {
            throw new Error('API limit reached. Please try again later.');
        } else if (error.message?.includes('timeout')) {
            throw new Error('Video processing timed out. Try with a shorter video.');
        } else {
            throw new Error(`Video processing failed: ${error.message}`);
        }
    }
}