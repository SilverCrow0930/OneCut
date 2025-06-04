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

const CONTENT_TYPE_INSTRUCTIONS = {
    storytelling: `
        You are a storytelling content expert specializing in viral narrative clips.
        This includes: vlogs, personal stories, lifestyle content, day-in-life, travel, personal experiences.
        Create engaging clips of 15-90 seconds optimized for story-driven audiences.
        Each cut should be of the format { src_start: number, src_end: number, description: string, captions: string[], viral_score: number, hook_type: string }
        
        STORYTELLING VIRAL PRIORITIES (score 1-10):
        - Emotional vulnerability, personal revelations (9-10)
        - Relatable everyday moments, "me too" content (8-9)
        - Beautiful/aesthetic visuals, lifestyle shots (8-9)
        - Unexpected plot twists in personal stories (7-9)
        - Authentic reactions to life events (7-8)
        - Behind-the-scenes personal moments (6-8)
        - Aspirational lifestyle content (6-7)
        
        STORYTELLING HOOK TYPES:
        - "personal_reveal": Intimate life revelations
        - "relatable_moment": Universal experiences
        - "aesthetic_hook": Visually beautiful content
        - "life_update": Major life changes
        - "authentic_reaction": Genuine emotional responses
        - "behind_scenes": Candid personal moments
        - "aspirational": Lifestyle goals/dreams
        
        Focus on authentic, relatable moments that create emotional connection.
        Story audiences want to feel understood and inspired.
        Prioritize genuine emotions over perfection.
    `,
    
    educational: `
        You are an educational content expert specializing in viral learning clips.
        This includes: tutorials, how-tos, tips, life hacks, explainers, DIY, cooking, science, skill-teaching.
        Create engaging clips of 15-90 seconds optimized for learning audiences.
        Each cut should be of the format { src_start: number, src_end: number, description: string, captions: string[], viral_score: number, hook_type: string }
        
        EDUCATIONAL VIRAL PRIORITIES (score 1-10):
        - Mind-blowing facts, "did you know" moments (9-10)
        - Clear step-by-step demonstrations (8-9)
        - Quick life hacks, time-saving tips (8-9)
        - Before/after transformations, results (7-9)
        - Common mistakes and how to avoid them (7-8)
        - Myth-busting, surprising truths (7-8)
        - Easy solutions to hard problems (6-8)
        
        EDUCATIONAL HOOK TYPES:
        - "fact_bomb": Surprising information
        - "quick_tip": Actionable advice
        - "how_to": Step-by-step instructions
        - "life_hack": Time/effort saving tips
        - "myth_buster": Correcting misconceptions
        - "before_after": Transformation results
        - "mistake_fix": Problem solutions
        
        Focus on immediately actionable content with clear value.
        Educational audiences want to learn something useful quickly.
        Prioritize clarity and practical application.
    `,
    
    entertainment: `
        You are an entertainment content expert specializing in viral comedy and reaction clips.
        This includes: comedy, memes, funny fails, reactions, challenges, skits, pranks, viral trends.
        Create engaging clips of 15-90 seconds optimized for entertainment audiences.
        Each cut should be of the format { src_start: number, src_end: number, description: string, captions: string[], viral_score: number, hook_type: string }
        
        ENTERTAINMENT VIRAL PRIORITIES (score 1-10):
        - Peak comedy moments, perfect punchlines (9-10)
        - Unexpected reactions, genuine surprises (9-10)
        - Epic fails, cringe moments (8-10)
        - Trending memes, viral references (8-9)
        - Shocking or outrageous moments (8-9)
        - Perfectly timed comedy beats (7-9)
        - Relatable awkward situations (6-8)
        
        ENTERTAINMENT HOOK TYPES:
        - "comedy_peak": Peak funny moments
        - "epic_fail": Spectacular mistakes
        - "shock_moment": Unexpected surprises
        - "meme_gold": Viral-worthy content
        - "cringe_moment": Awkwardly funny content
        - "reaction_hook": Genuine surprise responses
        - "trending_ref": Current viral references
        
        Focus on moments that evoke strong emotional responses.
        Entertainment audiences want to laugh, be shocked, or amazed.
        Prioritize authentic reactions and perfect timing.
    `,
    
    performance: `
        You are a performance content expert specializing in viral skill and talent clips.
        This includes: gaming highlights, sports, music, dance, talent showcases, fitness, achievements, competitions.
        Create engaging clips of 15-90 seconds optimized for performance audiences.
        Each cut should be of the format { src_start: number, src_end: number, description: string, captions: string[], viral_score: number, hook_type: string }
        
        PERFORMANCE VIRAL PRIORITIES (score 1-10):
        - Epic achievements, impossible feats (9-10)
        - Clutch moments under pressure (9-10)
        - Perfect technique, flawless execution (8-9)
        - Comeback victories, underdog wins (8-9)
        - Skilled combinations, impressive sequences (7-8)
        - Rare/difficult accomplishments (7-8)
        - Behind-the-scenes practice/preparation (6-7)
        
        PERFORMANCE HOOK TYPES:
        - "epic_moment": Incredible achievements
        - "clutch_play": High-pressure successes
        - "perfect_execution": Flawless technique
        - "comeback_story": Overcoming odds
        - "skill_showcase": Talent demonstrations
        - "rare_feat": Uncommon accomplishments
        - "practice_grind": Dedication/preparation
        
        Focus on moments of peak skill and achievement.
        Performance audiences appreciate expertise and dedication.
        Prioritize clear demonstrations of talent and success.
    `,
    
    conversation: `
        You are a conversation content expert specializing in viral discussion and debate clips.
        This includes: podcasts, interviews, debates, opinions, hot takes, Q&A, panel discussions, reactions to news.
        Create engaging clips of 15-90 seconds optimized for discussion audiences.
        Each cut should be of the format { src_start: number, src_end: number, description: string, captions: string[], viral_score: number, hook_type: string }
        
        CONVERSATION VIRAL PRIORITIES (score 1-10):
        - Controversial opinions, hot takes (9-10)
        - Quotable wisdom, memorable one-liners (8-10)
        - Heated debates, strong disagreements (8-9)
        - Personal revelations, vulnerable stories (8-9)
        - Industry insights, expert predictions (7-8)
        - Funny anecdotes, entertaining stories (7-8)
        - Thought-provoking observations (6-8)
        
        CONVERSATION HOOK TYPES:
        - "hot_take": Controversial opinions
        - "wisdom_drop": Quotable insights
        - "debate_fire": Heated discussions
        - "personal_story": Intimate revelations
        - "expert_insight": Professional knowledge
        - "funny_story": Entertaining anecdotes
        - "deep_thought": Philosophical observations
        
        Focus on moments that spark discussion and engagement.
        Conversation audiences want authentic dialogue and new perspectives.
        Prioritize quotable moments and strong opinions.
    `,
    
    business: `
        You are a business content expert specializing in viral professional and motivational clips.
        This includes: business advice, entrepreneurship, success stories, motivational content, industry insights, product demos, professional development.
        Create engaging clips of 15-90 seconds optimized for professional audiences.
        Each cut should be of the format { src_start: number, src_end: number, description: string, captions: string[], viral_score: number, hook_type: string }
        
        BUSINESS VIRAL PRIORITIES (score 1-10):
        - Actionable frameworks, proven strategies (9-10)
        - Success stories, case studies with results (8-10)
        - Industry predictions, trend analysis (8-9)
        - Common business mistakes to avoid (7-9)
        - Motivational insights, mindset shifts (7-8)
        - Tool/resource recommendations (6-8)
        - Behind-the-scenes business stories (6-7)
        
        BUSINESS HOOK TYPES:
        - "strategy_gold": Actionable frameworks
        - "success_story": Achievement examples
        - "future_trend": Industry predictions
        - "mistake_warning": What to avoid
        - "mindset_shift": Perspective changes
        - "tool_recommendation": Useful resources
        - "business_story": Professional experiences
        
        Focus on immediately applicable business value.
        Business audiences want practical insights and proven results.
        Prioritize actionable content over theoretical concepts.
    `
}

const systemInstruction = `
    You are a viral video editor and content strategist.
    Given a prompt and a video, you will make cuts to create engaging short-form videos of 15 to 90 seconds.
    Each cut should be of the format { src_start: number, src_end: number, description: string, captions: string[], viral_score: number, hook_type: string }
    
    VIRAL CONTENT PRIORITIES (score 1-10):
    - Strong emotional reactions or expressions (8-10)
    - Surprising revelations or "aha moments" (8-10) 
    - Quotable one-liners or memorable phrases (7-9)
    - Visual transformations or demonstrations (7-9)
    - Controversial or debate-worthy statements (6-8)
    - Trending topics or cultural references (6-8)
    - Funny moments or unexpected humor (7-9)
    - Educational insights delivered quickly (6-8)
    
    HOOK TYPES:
    - "question_hook": Starts with intriguing question
    - "shock_hook": Surprising statement or visual
    - "story_hook": "This happened to me..." narrative
    - "benefit_hook": "How to..." or "Learn..."
    - "controversy_hook": Polarizing or debate-worthy
    - "transformation_hook": Before/after or process
    
    CUTTING STRATEGY:
    1. START WITH IMPACT: First 3 seconds must grab attention
    2. BUILD TENSION: Create curiosity or anticipation  
    3. DELIVER PAYOFF: Provide resolution or key insight
    4. END WITH ENGAGEMENT: Question, CTA, or cliffhanger
    
    Each cut should be at least 10 seconds long and feel complete as a standalone piece.
    Prioritize cuts with viral_score > 6 and strong hook_types.
    Drop generic introductions, long explanations, and low-energy segments.
    Make sure the original video is fully visible in the final cut — do not crop or zoom in.
    
    Important: Include viral_score (1-10) and hook_type for each cut to help creators prioritize content.
    Listen carefully to transcribe accurate captions for each time segment.
`

const chatSystemInstruction = `
    You are Melody, an AI video editing assistant.
    Your role is to help users create and edit videos effectively.
    You are knowledgeable about:
    - Video editing techniques and best practices
    - Popular video editing software
    - Video formats and codecs
    - Video effects and transitions
    - Audio editing and sound design
    - Color grading and correction
    - Video composition and framing
    - Storytelling through video
    
    Be friendly, professional, and provide clear, actionable advice.
    If you don't know something, be honest about it.
    Keep responses concise but informative.
`

const transcriptionSystemInstruction = `
    You are an AI transcription assistant with multilingual capabilities specialized in creating accurate short video captions.
    
    Your task is to:
    1. AUTOMATICALLY DETECT the language spoken in the audio/video
    2. Transcribe ALL spoken words accurately in the ORIGINAL LANGUAGE
    3. Do NOT translate - keep the transcription in the same language as the speech
    4. Generate timestamped captions in standard SRT format
    5. Add proper punctuation and capitalization appropriate for the detected language
    6. Break captions into readable chunks suitable for short-form video
    7. Each chunk should be at most 6 words for optimal readability
    8. DO NOT add any HTML tags or highlighting - provide plain text only
    
    EXAMPLE OUTPUT:
    1
    00:00:01,000 --> 00:00:03,500
    This is amazing content!
    
    2
    00:00:03,500 --> 00:00:06,000
    Made 10,000 dollars in profit
    
    Supported languages include: English, Spanish, French, German, Italian, Portuguese, Russian, Chinese (Mandarin), Japanese, Korean, Arabic, Hindi, and many others.
    
    Be accurate with timing and make captions easy to read in the detected language.
    IMPORTANT: Never translate the content - always transcribe in the original spoken language.
    IMPORTANT: Provide clean text without any HTML tags or formatting.
`

const textStyleSystemInstruction = `
    You are a CSS text styling expert specialized in creating visually appealing text styles for video content.
    
    Your task is to:
    1. Analyze the user's natural language description of their desired text style
    2. Generate appropriate CSS properties that match their request
    3. Return ONLY a valid JSON object with CSS properties
    4. Focus on properties that work well for video text overlays
    5. Ensure high readability and visual impact
    
    Available CSS properties you can use:
    - fontFamily (use web-safe fonts or common Google Fonts)
    - fontSize (in pixels, reasonable range 16-48px)
    - fontWeight (100-900 or keywords like 'bold')
    - color (hex, rgb, or named colors)
    - background (colors, gradients, or 'none')
    - textShadow (for depth and readability)
    - WebkitTextStroke (for outlines)
    - textTransform ('none', 'uppercase', 'lowercase', 'capitalize')
    - letterSpacing (in pixels or em)
    - padding (for background styles)
    - borderRadius (for rounded backgrounds)
    - border (for outlined backgrounds)
    - textAlign ('left', 'center', 'right')
    - lineHeight (for multi-line text)
    - opacity (0-1)
    - transform (for effects like rotation, but use sparingly)
    
    Guidelines:
    - Ensure text is readable against various backgrounds
    - Use text shadows or outlines when text might be hard to read
    - For vibrant styles, use bold fonts and high contrast
    - For elegant styles, use sophisticated fonts and subtle effects
    - For modern styles, use clean fonts and minimal effects
    - For retro styles, use appropriate fonts and nostalgic colors
    
    IMPORTANT: Return ONLY valid JSON, no explanations or additional text.
    
    Example output for "neon cyberpunk style":
    {
        "fontFamily": "Arial, sans-serif",
        "fontSize": 24,
        "fontWeight": "bold",
        "color": "#00FFFF",
        "background": "none",
        "textShadow": "0 0 10px #00FFFF, 0 0 20px #00FFFF, 0 0 30px #00FFFF",
        "textTransform": "uppercase",
        "letterSpacing": "2px"
    }
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

export const generateContent = async (prompt: string, signedUrl: string, mimeType: string, contentType?: string) => {
    // If signedUrl is empty, this is a chat request
    if (!signedUrl) {
        try {
            const chatResponse = await ai.models.generateContent({
                model: model,
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                config: {
                    systemInstruction: chatSystemInstruction,
                    maxOutputTokens: 2048,
                    temperature: 0.7,
                    topP: 0.8,
                    topK: 40,
                },
            });

            if (!chatResponse.candidates?.[0]?.content?.parts?.[0]?.text) {
                throw new Error('No response from chat model');
            }

            return {
                thoughts: { text: '' },
                textOutput: { text: chatResponse.candidates[0].content.parts[0].text }
            };
        } catch (error) {
            console.error('Chat error:', error);
            throw error;
        }
    }

    console.log('=== GOOGLE GENAI CONTENT GENERATION STARTED ===');
    console.log('Input parameters:', {
        promptLength: prompt.length,
        mimeType,
        signedUrlLength: signedUrl.length,
        contentType
    });

    // Select appropriate system instruction based on content type
    const selectedSystemInstruction = contentType && CONTENT_TYPE_INSTRUCTIONS[contentType as keyof typeof CONTENT_TYPE_INSTRUCTIONS] 
        ? CONTENT_TYPE_INSTRUCTIONS[contentType as keyof typeof CONTENT_TYPE_INSTRUCTIONS]
        : systemInstruction;

    console.log('Using system instruction for content type:', contentType || 'general');

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
                    systemInstruction: selectedSystemInstruction,
                    thinkingConfig: {
                        includeThoughts: true,
                    },
                    maxOutputTokens: 8192,
                    temperature: 0.7,
                    topP: 0.8,
                    topK: 40,
                },
            }).catch((error: any) => {
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
            .find((part: any) => part.thought === true)?.text;

        console.log('Model thoughts:', {
            length: thoughts?.length || 0,
            preview: thoughts?.substring(0, 100) + '...'
        });

        const textOutput = modelResponse.candidates[0].content.parts
            .find((part: any) => !('thought' in part))?.text;

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

export const generateTranscription = async (signedUrl: string, mimeType: string) => {
    console.log('=== GOOGLE GENAI TRANSCRIPTION STARTED ===');
    console.log('Input parameters:', {
        mimeType,
        signedUrlLength: signedUrl.length
    });

    try {
        // Download the video/audio file
        console.log('Starting media file download for transcription...');
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
            throw new Error(`Failed to download media file: ${fileResponse.status} ${fileResponse.statusText}`);
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
            throw new Error('Media file is empty');
        }

        const blob = new Blob([buffer], { type: mimeType });
        console.log('Blob created for transcription:', {
            size: blob.size,
            type: blob.type
        });

        // Upload the file to Google GenAI
        console.log('Initiating file upload to Google GenAI for transcription...');
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

        console.log('File upload completed for transcription:', {
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

        console.log('Waiting for file to become active for transcription...');
        try {
            await waitForFileActive(uploadedFile.name);
            console.log('File is now active, proceeding with transcription');
        } catch (error) {
            console.error('Error waiting for file to become active:', {
                error: error instanceof Error ? {
                    name: error.name,
                    message: error.message,
                    stack: error.stack
                } : error
            });
            throw new Error(`Media processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        const content = createUserContent([
            'Please listen to this audio/video content, DETECT the language being spoken, and transcribe it accurately in the ORIGINAL LANGUAGE (do not translate). Provide timestamped captions in SRT format with accurate timing.',
            createPartFromUri(uploadedFile.uri, mimeType)
        ]);

        console.log('Sending content to model for transcription...');
        const modelStartTime = Date.now();
        const modelResponse = await Promise.race([
            ai.models.generateContent({
                model: model,
                contents: [content],
                config: {
                    systemInstruction: transcriptionSystemInstruction,
                    maxOutputTokens: 8192,
                    temperature: 0.1, // Lower temperature for more accurate transcription
                    topP: 0.8,
                    topK: 40,
                },
            }).catch((error: any) => {
                console.error('Gemini API transcription error details:', {
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

        console.log('Model transcription completed:', {
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

        const transcriptionOutput = modelResponse.candidates[0].content.parts
            .find((part: any) => !('thought' in part))?.text;

        console.log('Model transcription output:', {
            length: transcriptionOutput?.length || 0,
            preview: transcriptionOutput?.substring(0, 200) + '...'
        });

        console.log('=== GOOGLE GENAI TRANSCRIPTION COMPLETED ===');
        return {
            transcription: transcriptionOutput || ''
        }
    }
    catch (error) {
        console.error('=== GOOGLE GENAI TRANSCRIPTION FAILED ===');
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

export const generateTextStyle = async (stylePrompt: string, sampleText: string = 'Sample Text') => {
    console.log('=== GOOGLE GENAI TEXT STYLE GENERATION STARTED ===');
    console.log('Input parameters:', {
        stylePrompt,
        sampleText
    });

    try {
        const prompt = `Generate CSS styles for the following text style request: "${stylePrompt}"
        
        The text to be styled is: "${sampleText}"
        
        Return a JSON object with CSS properties that will create the requested style effect.`;

        const response = await ai.models.generateContent({
            model: model,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
                systemInstruction: textStyleSystemInstruction,
                maxOutputTokens: 1024,
                temperature: 0.7,
                topP: 0.8,
                topK: 40,
            },
        });

        console.log('Model style generation completed');

        if (!response.candidates?.[0]?.content?.parts?.[0]?.text) {
            throw new Error('No response from style generation model');
        }

        const styleOutput = response.candidates[0].content.parts[0].text;
        
        console.log('Model style output:', {
            length: styleOutput.length,
            preview: styleOutput.substring(0, 200) + '...'
        });

        // Parse the JSON output
        let parsedStyle;
        try {
            // Extract JSON from the response (in case there's extra text)
            const jsonMatch = styleOutput.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                parsedStyle = JSON.parse(jsonMatch[0]);
            } else {
                // Try parsing the entire response
                parsedStyle = JSON.parse(styleOutput);
            }
        } catch (parseError) {
            console.error('Failed to parse style JSON:', parseError);
            throw new Error('AI generated invalid style format');
        }

        // Validate that we have a valid style object
        if (!parsedStyle || typeof parsedStyle !== 'object') {
            throw new Error('AI generated invalid style object');
        }

        console.log('=== GOOGLE GENAI TEXT STYLE GENERATION COMPLETED ===');
        return {
            style: parsedStyle
        };
    } catch (error) {
        console.error('=== GOOGLE GENAI TEXT STYLE GENERATION FAILED ===');
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