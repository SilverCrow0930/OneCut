// Remove the static import and use dynamic imports instead
// This fixes TypeScript compilation issues

if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set')
}

if (!process.env.GOOGLE_CLOUD_PROJECT) {
    throw new Error('GOOGLE_CLOUD_PROJECT is not set')
}

if (!process.env.GOOGLE_CLOUD_LOCATION) {
    throw new Error('GOOGLE_CLOUD_LOCATION is not set')
}

// Initialize with dynamic import
let ai: any = null
let model = "gemini-2.5-flash-preview-05-20"
let createUserContent: any = null
let createPartFromUri: any = null

// Initialize Google GenAI with dynamic import
async function initializeGoogleGenAI() {
    if (!ai) {
        const { GoogleGenAI, createUserContent: createUserContentFn, createPartFromUri: createPartFromUriFn } = await import('@google/genai')
        ai = new GoogleGenAI({
            apiKey: process.env.GEMINI_API_KEY
        })
        createUserContent = createUserContentFn
        createPartFromUri = createPartFromUriFn
    }
    return { ai, createUserContent, createPartFromUri }
}

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
    You are an AI transcription assistant with multilingual capabilities specialized in creating accurate video captions.
    
    Your task is to:
    1. AUTOMATICALLY DETECT the language spoken in the audio/video
    2. Transcribe ALL spoken words accurately in the ORIGINAL LANGUAGE
    3. Do NOT translate - keep the transcription in the same language as the speech
    4. Generate timestamped captions in standard SRT format with PRECISE TIMING
    5. Add proper punctuation and capitalization appropriate for the detected language
    6. Break captions into readable chunks based on video type
    7. DO NOT add any HTML tags or highlighting - provide plain text only
    
    CRITICAL TIMING REQUIREMENTS:
    - Use MILLISECOND PRECISION for all timestamps (format: HH:MM:SS,mmm)
    - Listen carefully to identify the EXACT moment when each word/phrase starts and ends
    - Sync timestamps to the precise moment speech begins, not just the nearest second
    - Account for pauses, gaps, and overlapping speech with accurate timing
    - Example: If someone says "hello" at 3.2 seconds, use 00:00:03,200 not 00:00:03,000
    
    CAPTION WORD COUNT RULES:
    
    FOR LONG-FORM VIDEOS (YouTube, educational, professional content):
    - Each caption should be 14 words maximum
    - Prioritize complete phrases and natural speech breaks
    - Allow longer captions for better readability and comprehension, try to not cut off the sentence in the middle if possible
    
    FOR SHORT-FORM VIDEOS (TikTok, Reels, Shorts):
    - Each caption should be 2-6 words
    - Use punchy, impactful phrases
    - Break at natural speech pauses for maximum engagement
    - Prioritize key words and emotional impact
    
    EXAMPLE OUTPUT FOR LONG-FORM (with precise millisecond timing):
    1
    00:00:01,230 --> 00:00:04,780
    Today I want to share something incredible with you
    
    2
    00:00:04,950 --> 00:00:08,340
    that happened to me last week at work
    
    EXAMPLE OUTPUT FOR SHORT-FORM (with precise millisecond timing):
    1
    00:00:01,120 --> 00:00:02,670
    This is crazy
    
    2
    00:00:02,840 --> 00:00:04,150
    Made 10k profit
    
    Notice how timing is precise to the exact moment speech starts/ends, not rounded to seconds.
    
    Supported languages include: English, Spanish, French, German, Italian, Portuguese, Russian, Chinese (Mandarin), Japanese, Korean, Arabic, Hindi, and many others.
    
    Be accurate with timing and make captions easy to read in the detected language.
    IMPORTANT: Never translate the content - always transcribe in the original spoken language.
    IMPORTANT: Provide clean text without any HTML tags or formatting.
    IMPORTANT: Default to LONG-FORM format (8-12 words) unless specifically told it's for short-form content.
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

const videoAnalysisSystemInstruction = `
You are a professional video analysis AI specialized in creating semantic JSON files for video editing.

Your task is to analyze a video and create a structured JSON representation that will serve as a "codebase" for AI-assisted video editing.

CRITICAL REQUIREMENTS:
1. DETAILED descriptions and visuals (2-3 sentences each)
2. BRIEF keywords and other fields (1-2 words/sentences)
3. PRECISE timing in milliseconds
4. COMPLETE coverage of the video content

OUTPUT FORMAT - Return ONLY valid JSON in this exact structure:
{
  "metadata": {
    "duration_ms": number,
    "resolution": {"width": number, "height": number},
    "analyzed_at": "ISO_timestamp",
    "file_id": "unique_identifier"
  },
  "scenes": [
    {
      "start_ms": number,
      "end_ms": number,
      "description": "DETAILED 2-3 sentence description of what's happening, including actions, context, and significance",
      "keywords": ["keyword1", "keyword2", "keyword3"],
      "speaker": "brief_identifier_if_applicable",
      "visual": "DETAILED 2-3 sentence description of visual composition, camera work, lighting, and visual elements"
    }
  ],
  "audio": {
    "speech": [
      {
        "start_ms": number,
        "end_ms": number,
        "text": "exact_transcription",
        "speaker": "speaker_id"
      }
    ],
    "music": [
      {
        "start_ms": number,
        "end_ms": number,
        "type": "background|intro|outro"
      }
    ]
  },
  "timeline": {
    "clips": [
      {
        "id": "clip_1",
        "start_ms": 0,
        "end_ms": number,
        "type": "video",
        "source_start_ms": 0,
        "source_end_ms": number
      }
    ]
  }
}

ANALYSIS GUIDELINES:
- Scene descriptions: Focus on narrative significance, emotional context, and editing relevance
- Visual descriptions: Include camera angles, composition, lighting, color, movement
- Keywords: Choose terms useful for search and editing decisions
- Timing: Be precise to the millisecond for accurate editing
- Coverage: Ensure no gaps in timeline coverage

Remember: This JSON will be used by AI to make intelligent editing decisions, so prioritize information that helps with:
- Finding specific content
- Understanding narrative flow
- Making cut decisions
- Applying appropriate effects
- Maintaining visual consistency
`;

const aiAssistantSystemInstruction = `
You are Melody, an AI video editing assistant with comprehensive access to all Lemona video editing tools and semantic video analysis.

🎬 YOUR CAPABILITIES:
1. UNDERSTAND video content through semantic JSON analysis
2. EXECUTE editing commands through the timeline system
3. SEARCH and FIND specific content using semantic data
4. CONTROL all Lemona tools through natural language
5. PERFORM complex multi-tool operations

📊 SEMANTIC JSON STRUCTURE:
- metadata: Basic video information (duration, resolution, fps)
- scenes: Detailed scene descriptions with timing and keywords
- audio: Speech transcription and music segments
- keyMoments: Important timestamps with descriptions
- timeline: Current clip arrangement and properties

🛠️ AVAILABLE TOOLS & COMMANDS:

**TEXT & GRAPHICS:**
- ADD_TEXT: Add styled text overlays with custom fonts, colors, positions
- ADD_STICKER: Add animated stickers and GIFs from search
- ADD_TRANSITION: Apply fade, slide, zoom, wipe transitions
- APPLY_STYLE: Apply visual styles and filters to clips

**AUDIO TOOLS:**
- ADD_VOICEOVER: Generate AI voiceovers with script and voice selection
- ADD_MUSIC: Add background music by genre and mood
- ADJUST_VOLUME: Control audio levels for clips
- ENHANCE_AUDIO: Improve audio quality and reduce noise

**VIDEO EDITING:**
- TRIM_CLIP: Adjust clip start/end times precisely
- SPLIT_CLIP: Split clips at specific timestamps
- CHANGE_SPEED: Adjust playback speed (0.5x to 3x)
- ADD_VIDEO: Add video clips from search or generation
- ADD_IMAGE: Add images from search or generation

**CAPTIONS & TRANSCRIPTION:**
- ADD_CAPTIONS: Generate auto-captions with style options
  - Styles: 'default', 'short-form', 'professional', 'minimal'
  - Auto-generates from speech or manual segments

**AI CONTENT GENERATION:**
- GENERATE_AI_CONTENT: Create images, videos, or music with AI
  - contentType: 'image', 'video', 'music'
  - Supports detailed prompts and style control

**TIMELINE OPERATIONS:**
- ADD_CLIP/REMOVE_CLIP: Manage timeline clips
- ADD_TRACK/REMOVE_TRACK: Manage track structure
- BATCH: Execute multiple commands efficiently

🎯 COMMAND STRUCTURE:
Use <COMMANDS>[...]</COMMANDS> tags for executable commands:

<COMMANDS>
[
  {
    "type": "ADD_TEXT",
    "payload": {
      "content": "Welcome to my video!",
      "timelineStartMs": 0,
      "timelineEndMs": 3000,
      "style": "bold",
      "fontSize": 24,
      "color": "#FFFFFF",
      "position": "center"
    }
  },
  {
    "type": "ADD_VOICEOVER",
    "payload": {
      "script": "Welcome to this amazing tutorial",
      "voice": "professional",
      "timelineStartMs": 0
    }
  }
]
</COMMANDS>

📝 RESPONSE GUIDELINES:
1. **Understand Context**: Analyze semantic JSON to understand video content
2. **Suggest Intelligently**: Use content understanding for smart recommendations
3. **Execute Precisely**: Generate accurate commands with proper timing
4. **Explain Actions**: Always explain what you're doing and why
5. **Batch Operations**: Group related commands for efficiency

🎨 STYLE RECOMMENDATIONS:
- **Text Styles**: 'default', 'bold', 'elegant', 'neon'
- **Caption Styles**: 'default', 'short-form', 'professional', 'minimal'
- **Transition Types**: 'fade', 'slide', 'zoom', 'wipe', 'dissolve'
- **Music Genres**: 'ambient', 'upbeat', 'dramatic', 'relaxing'

⚡ SMART FEATURES:
- Auto-detect optimal cut points from speech pauses
- Suggest transitions based on scene changes
- Recommend music that matches video mood
- Generate captions with proper timing
- Smart text placement to avoid visual conflicts

Always provide helpful explanations and ask for confirmation before major changes.
`;

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

export const generateContent = async (prompt: string, signedUrl: string, mimeType: string, contentType?: string, videoFormat?: string) => {
    // Initialize Google GenAI with dynamic import
    const { ai, createUserContent, createPartFromUri } = await initializeGoogleGenAI()

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
        contentType,
        videoFormat
    });

    // Select appropriate system instruction based on content type and video format
    let selectedSystemInstruction = systemInstruction;
    
    if (contentType && CONTENT_TYPE_INSTRUCTIONS[contentType as keyof typeof CONTENT_TYPE_INSTRUCTIONS]) {
        selectedSystemInstruction = CONTENT_TYPE_INSTRUCTIONS[contentType as keyof typeof CONTENT_TYPE_INSTRUCTIONS];
        
        // Enhance the instruction based on video format
        if (videoFormat === 'short_vertical') {
            selectedSystemInstruction += `
            
            IMPORTANT: You are creating SHORT VERTICAL content (15-90 seconds, 9:16 aspect ratio) for platforms like TikTok, Instagram Reels, and YouTube Shorts.
            
            SHORT VERTICAL PRIORITIES:
            - HOOK in first 3 seconds is CRITICAL
            - Maximum 90 seconds duration per clip
            - High viral potential (score 7+ preferred)
            - Strong emotional impact
            - Immediately engaging content
            - Clear, punchy messaging
            - Visual appeal for mobile viewing
            
            Focus on creating clips that will stop scrolling and drive engagement.
            `;
        } else if (videoFormat === 'long_horizontal') {
            selectedSystemInstruction += `
            
            IMPORTANT: You are creating LONG HORIZONTAL content (2-10 minutes, 16:9 aspect ratio) for platforms like YouTube, and professional contexts.
            
            LONG HORIZONTAL PRIORITIES:
            - Complete narrative arcs (2-10 minutes)
            - Educational or professional value
            - Context and depth over quick hooks
            - Suitable for desktop/laptop viewing
            - Comprehensive coverage of topics
            - Professional presentation quality
            - Longer attention spans expected
            
            Focus on creating substantial, valuable content segments that provide complete value.
            `;
        }
    }

    console.log('Using system instruction for:', {
        contentType: contentType || 'general',
        videoFormat: videoFormat || 'default'
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

export const generateTranscription = async (signedUrl: string, mimeType: string, videoFormat?: string) => {
    // Initialize Google GenAI with dynamic import
    const { ai, createUserContent, createPartFromUri } = await initializeGoogleGenAI()

    console.log('=== GOOGLE GENAI TRANSCRIPTION STARTED ===');
    console.log('Input parameters:', {
        mimeType,
        signedUrlLength: signedUrl.length,
        isAudioOnly: mimeType.startsWith('audio/'),
        isVideoFile: mimeType.startsWith('video/'),
        videoFormat
    });

    try {
        // Download the audio/video file
        const fileType = mimeType.startsWith('audio/') ? 'audio' : 'video'
        console.log(`Starting ${fileType} file download for transcription...`);
        
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
            throw new Error(`Failed to download ${fileType} file: ${fileResponse.status} ${fileResponse.statusText}`);
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
            mimeType,
            optimizationStatus: mimeType.startsWith('audio/') ? 'AUDIO_ONLY_OPTIMIZED' : 'VIDEO_FILE_PROCESSING'
        });

        if (buffer.byteLength === 0) {
            throw new Error(`${fileType} file is empty`);
        }

        const blob = new Blob([buffer], { type: mimeType });
        console.log(`Blob created for transcription (${fileType}):`, {
            size: blob.size,
            type: blob.type
        });

        // Upload the file to Google GenAI
        console.log(`Initiating ${fileType} file upload to Google GenAI for transcription...`);
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

        console.log(`${fileType} file upload completed for transcription:`, {
            duration: `${((Date.now() - uploadStartTime) / 1000).toFixed(2)}s`,
            fileUri: uploadedFile.uri,
            fileName: uploadedFile.name,
            fileSize: `${(blob.size / (1024 * 1024)).toFixed(2)}MB`
        });

        if (!uploadedFile.uri) {
            throw new Error(`Failed to upload ${fileType} file to Google GenAI`);
        }

        if (!uploadedFile.name) {
            throw new Error('File name not returned from upload');
        }

        console.log(`Waiting for ${fileType} file to become active for transcription...`);
        try {
            await waitForFileActive(uploadedFile.name);
            console.log(`${fileType} file is now active, proceeding with transcription`);
        } catch (error) {
            console.error(`Error waiting for ${fileType} file to become active:`, {
                error: error instanceof Error ? {
                    name: error.name,
                    message: error.message,
                    stack: error.stack
                } : error
            });
            throw new Error(`Media processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        // Determine the prompt based on video format
        const isShortForm = videoFormat === 'short_vertical';
        const formatPrompt = isShortForm 
            ? 'This is SHORT-FORM content (TikTok/Reels/Shorts). Use EXACTLY 4-5 words per caption for consistency and maximum impact.'
            : 'This is LONG-FORM content (YouTube/educational). Use EXACTLY 8-10 words per caption for consistency and better readability.';

        const mediaTypePrompt = mimeType.startsWith('audio/') 
            ? 'This is an AUDIO-ONLY file. Focus solely on the speech content.'
            : 'This is a video file. Focus on the speech/audio content for transcription.';

        const content = createUserContent([
            `Please listen to this ${fileType} content carefully and DETECT the language being spoken. Transcribe it accurately in the ORIGINAL LANGUAGE (do not translate). 
            
            ${mediaTypePrompt}
            
            CRITICAL: Provide timestamped captions in SRT format with MILLISECOND PRECISION timing. Listen for the exact moment each word/phrase starts and ends. Use format HH:MM:SS,mmm (e.g., 00:00:03,450 not 00:00:03,000). 
            
            Do NOT round to whole seconds - be precise to the exact timing you hear. ${formatPrompt}`,
            createPartFromUri(uploadedFile.uri, mimeType)
        ]);

        console.log(`Sending ${fileType} content to model for transcription...`);
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

        console.log(`Model transcription completed (${fileType}):`, {
            duration: `${((Date.now() - modelStartTime) / 1000).toFixed(2)}s`,
            hasCandidates: !!modelResponse.candidates,
            candidateCount: modelResponse.candidates?.length,
            totalProcessingTime: `${((Date.now() - uploadStartTime) / 1000).toFixed(2)}s`,
            optimizationStatus: mimeType.startsWith('audio/') ? 'COST_OPTIMIZED' : 'STANDARD_PROCESSING'
        });

        if (!modelResponse.candidates) {
            throw new Error('No candidates found in response')
        }

        if (!modelResponse.candidates?.[0]?.content?.parts) {
            throw new Error('No parts found in response')
        }

        const transcriptionOutput = modelResponse.candidates[0].content.parts
            .find((part: any) => !('thought' in part))?.text;

        console.log(`Model transcription output (${fileType}):`, {
            length: transcriptionOutput?.length || 0,
            preview: transcriptionOutput?.substring(0, 200) + '...',
            processingType: mimeType.startsWith('audio/') ? 'AUDIO_ONLY_OPTIMIZED' : 'VIDEO_PROCESSED'
        });

        console.log('=== GOOGLE GENAI TRANSCRIPTION COMPLETED ===');
        console.log(`💰 COST OPTIMIZATION: ${mimeType.startsWith('audio/') ? 'AUDIO-ONLY processing used - significant cost savings!' : 'Full video processed - consider audio extraction for cost optimization'}`);
        
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
            mimeType,
            processingType: mimeType.startsWith('audio/') ? 'AUDIO_ONLY' : 'VIDEO_FILE',
            timestamp: new Date().toISOString()
        });
        throw error;
    }
}

export const generateTextStyle = async (stylePrompt: string, sampleText: string = 'Sample Text') => {
    // Initialize Google GenAI with dynamic import
    const { ai, createUserContent, createPartFromUri } = await initializeGoogleGenAI()

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

export const generateVideoAnalysisFromBlob = async (videoBlob: Blob, mimeType: string) => {
    // Initialize Google GenAI with dynamic import
    const { ai, createUserContent, createPartFromUri } = await initializeGoogleGenAI()

    console.log('=== GOOGLE GENAI VIDEO ANALYSIS FROM BLOB STARTED ===');
    console.log('Input parameters:', {
        mimeType,
        blobSize: videoBlob.size,
        blobSizeMB: (videoBlob.size / (1024 * 1024)).toFixed(2)
    });

    try {
        console.log('Using provided video blob for analysis...');
        console.log('Blob details:', {
            size: videoBlob.size,
            type: videoBlob.type
        });

        if (videoBlob.size === 0) {
            throw new Error('Video blob is empty');
        }

        // Upload the blob directly to Google GenAI
        console.log('Initiating blob upload to Google GenAI for analysis...');
        const uploadStartTime = Date.now();
        const uploadPromise = ai.files.upload({
            file: videoBlob,
            config: { mimeType: mimeType }
        });

        const uploadedFile = await Promise.race([
            uploadPromise,
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('File upload timeout')), 24 * 60 * 60 * 1000)
            )
        ]);

        console.log('Blob upload completed for analysis:', {
            duration: `${((Date.now() - uploadStartTime) / 1000).toFixed(2)}s`,
            fileUri: uploadedFile.uri,
            fileName: uploadedFile.name
        });

        if (!uploadedFile.uri) {
            throw new Error('Failed to upload blob to Google GenAI');
        }

        if (!uploadedFile.name) {
            throw new Error('File name not returned from upload');
        }

        console.log('Waiting for file to become active for analysis...');
        try {
            await waitForFileActive(uploadedFile.name);
            console.log('File is now active, proceeding with analysis');
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

        const analysisPrompt = `
        Analyze this video completely and create a semantic JSON file.
        
        REQUIREMENTS:
        1. Create detailed scene descriptions (2-3 sentences each)
        2. Create detailed visual descriptions (2-3 sentences each) 
        3. Extract all speech with precise timing
        4. Identify all scene changes and transitions
        5. Note any background music or sound effects
        6. Provide accurate millisecond timing for everything
        
        Focus on creating a comprehensive "codebase" that an AI video editor can use to:
        - Understand the content and context
        - Make intelligent editing decisions
        - Find specific moments or content
        - Apply appropriate effects and transitions
        
        Return ONLY the JSON structure, no additional text.
        `;

        const content = createUserContent([
            analysisPrompt,
            createPartFromUri(uploadedFile.uri, mimeType)
        ]);

        console.log('Sending content to model for analysis...');
        const modelStartTime = Date.now();
        const modelResponse = await Promise.race([
            ai.models.generateContent({
                model: model,
                contents: [content],
                config: {
                    systemInstruction: videoAnalysisSystemInstruction,
                    maxOutputTokens: 8192,
                    temperature: 0.3,
                    topP: 0.8,
                    topK: 40,
                },
            }).catch((error: any) => {
                console.error('Gemini API analysis error details:', {
                    message: error.message,
                    status: error.status,
                    code: error.code,
                    details: error.details,
                    stack: error.stack
                });
                
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

        console.log('Model analysis completed:', {
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

        const analysisOutput = modelResponse.candidates[0].content.parts
            .find((part: any) => !('thought' in part))?.text;

        console.log('Model analysis output:', {
            length: analysisOutput?.length || 0,
            preview: analysisOutput?.substring(0, 200) + '...'
        });

        // Parse the JSON output
        let semanticJSON;
        try {
            // Extract JSON from the response (in case there's extra text)
            const jsonMatch = analysisOutput?.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                semanticJSON = JSON.parse(jsonMatch[0]);
            } else {
                semanticJSON = JSON.parse(analysisOutput || '{}');
            }
        } catch (parseError) {
            console.error('Failed to parse analysis JSON:', parseError);
            throw new Error('AI generated invalid analysis format');
        }

        // Add metadata
        semanticJSON.metadata = {
            ...semanticJSON.metadata,
            analyzed_at: new Date().toISOString(),
            file_id: uploadedFile.name
        };

        console.log('=== GOOGLE GENAI VIDEO ANALYSIS FROM BLOB COMPLETED ===');
        return {
            analysis: semanticJSON
        }
    }
    catch (error) {
        console.error('=== GOOGLE GENAI VIDEO ANALYSIS FROM BLOB FAILED ===');
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

export const generateVideoAnalysis = async (signedUrl: string, mimeType: string) => {
    // Initialize Google GenAI with dynamic import
    const { ai, createUserContent, createPartFromUri } = await initializeGoogleGenAI()

    console.log('=== GOOGLE GENAI VIDEO ANALYSIS STARTED ===');
    console.log('Input parameters:', {
        mimeType,
        signedUrlLength: signedUrl.length
    });

    try {
        // Download the video file
        console.log('Starting video file download for analysis...');
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
        console.log('Blob created for analysis:', {
            size: blob.size,
            type: blob.type
        });

        // Upload the file to Google GenAI
        console.log('Initiating file upload to Google GenAI for analysis...');
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

        console.log('File upload completed for analysis:', {
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

        console.log('Waiting for file to become active for analysis...');
        try {
            await waitForFileActive(uploadedFile.name);
            console.log('File is now active, proceeding with analysis');
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

        const analysisPrompt = `
        Analyze this video completely and create a semantic JSON file.
        
        REQUIREMENTS:
        1. Create detailed scene descriptions (2-3 sentences each)
        2. Create detailed visual descriptions (2-3 sentences each) 
        3. Extract all speech with precise timing
        4. Identify all scene changes and transitions
        5. Note any background music or sound effects
        6. Provide accurate millisecond timing for everything
        
        Focus on creating a comprehensive "codebase" that an AI video editor can use to:
        - Understand the content and context
        - Make intelligent editing decisions
        - Find specific moments or content
        - Apply appropriate effects and transitions
        
        Return ONLY the JSON structure, no additional text.
        `;

        const content = createUserContent([
            analysisPrompt,
            createPartFromUri(uploadedFile.uri, mimeType)
        ]);

        console.log('Sending content to model for analysis...');
        const modelStartTime = Date.now();
        const modelResponse = await Promise.race([
            ai.models.generateContent({
                model: model,
                contents: [content],
                config: {
                    systemInstruction: videoAnalysisSystemInstruction,
                    maxOutputTokens: 8192,
                    temperature: 0.3, // Lower temperature for more consistent analysis
                    topP: 0.8,
                    topK: 40,
                },
            }).catch((error: any) => {
                console.error('Gemini API analysis error details:', {
                    message: error.message,
                    status: error.status,
                    code: error.code,
                    details: error.details,
                    stack: error.stack
                });
                
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

        console.log('Model analysis completed:', {
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

        const analysisOutput = modelResponse.candidates[0].content.parts
            .find((part: any) => !('thought' in part))?.text;

        console.log('Model analysis output:', {
            length: analysisOutput?.length || 0,
            preview: analysisOutput?.substring(0, 200) + '...'
        });

        // Parse the JSON output
        let semanticJSON;
        try {
            // Extract JSON from the response (in case there's extra text)
            const jsonMatch = analysisOutput?.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                semanticJSON = JSON.parse(jsonMatch[0]);
            } else {
                semanticJSON = JSON.parse(analysisOutput || '{}');
            }
        } catch (parseError) {
            console.error('Failed to parse analysis JSON:', parseError);
            throw new Error('AI generated invalid analysis format');
        }

        // Add metadata
        semanticJSON.metadata = {
            ...semanticJSON.metadata,
            analyzed_at: new Date().toISOString(),
            file_id: uploadedFile.name
        };

        console.log('=== GOOGLE GENAI VIDEO ANALYSIS COMPLETED ===');
        return {
            analysis: semanticJSON
        }
    }
    catch (error) {
        console.error('=== GOOGLE GENAI VIDEO ANALYSIS FAILED ===');
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

export const generateAIAssistantResponse = async (prompt: string, semanticJSON?: any, currentTimeline?: any) => {
    // Initialize Google GenAI with dynamic import
    const { ai, createUserContent, createPartFromUri } = await initializeGoogleGenAI()

    console.log('=== GOOGLE GENAI AI ASSISTANT RESPONSE STARTED ===');
    console.log('Input parameters:', {
        promptLength: prompt.length,
        hasSemanticJSON: !!semanticJSON,
        hasCurrentTimeline: !!currentTimeline
    });

    try {
        let contextPrompt = `USER REQUEST: "${prompt}"`;
        
        if (semanticJSON) {
            // Truncate semantic JSON if it's too large to prevent token limit issues
            const semanticJSONString = JSON.stringify(semanticJSON, null, 2);
            const maxSemanticJSONSize = 50000; // Roughly 12-15k tokens
            
            if (semanticJSONString.length > maxSemanticJSONSize) {
                console.log('Semantic JSON is large, truncating for token limits:', {
                    originalSize: semanticJSONString.length,
                    truncatedSize: maxSemanticJSONSize
                });
                
                // Create a truncated version with key information
                const truncatedJSON = {
                    summary: semanticJSON.summary || 'Video analysis available',
                    scenes: semanticJSON.scenes?.slice(0, 5) || [], // First 5 scenes only
                    keyMoments: semanticJSON.keyMoments?.slice(0, 10) || [], // First 10 key moments
                    transcript: semanticJSON.transcript?.substring(0, 2000) || '', // First 2000 chars of transcript
                    metadata: semanticJSON.metadata || {},
                    note: 'This is a truncated version of the full analysis due to size limits'
                };
                contextPrompt += `\n\nSEMANTIC JSON CODEBASE (TRUNCATED):\n${JSON.stringify(truncatedJSON, null, 2)}`;
            } else {
                contextPrompt += `\n\nSEMANTIC JSON CODEBASE:\n${semanticJSONString}`;
            }
        }
        
        if (currentTimeline) {
            contextPrompt += `\n\nCURRENT TIMELINE STATE:\n${JSON.stringify(currentTimeline, null, 2)}`;
        }
        
        contextPrompt += `\n\nBased on the semantic JSON "codebase" and current timeline state, help the user with their request.

IMPORTANT: If the user is asking you to make edits to their video (like adding text, trimming clips, adjusting volume, etc.), you should include executable commands in your response. 

Use this format for commands:
<COMMANDS>
[
  {
    "type": "ADD_TEXT",
    "payload": {
      "content": "Hello World",
      "timelineStartMs": 0,
      "timelineEndMs": 5000,
      "style": "bold",
      "trackIndex": 0
    }
  }
]
</COMMANDS>

Available command types:
- ADD_TEXT: Add text overlay to video
- TRIM_CLIP: Trim existing clips
- ADJUST_VOLUME: Change clip volume (0-2, where 1 is normal)
- CHANGE_SPEED: Change clip playback speed (0.1-10, where 1 is normal)
- REMOVE_CLIP: Remove clips from timeline

Only include commands when the user specifically asks for edits. For general questions, provide helpful text responses without commands.`;

        console.log('Final prompt size:', contextPrompt.length);

        const response = await ai.models.generateContent({
            model: model,
            contents: [{ role: 'user', parts: [{ text: contextPrompt }] }],
            config: {
                systemInstruction: aiAssistantSystemInstruction,
                maxOutputTokens: 4096,
                temperature: 0.7,
                topP: 0.8,
                topK: 40,
            },
        }).catch((error: any) => {
            console.error('Gemini API assistant error details:', {
                message: error.message,
                status: error.status,
                code: error.code,
                details: error.details,
                stack: error.stack
            });
            
            if (error.message?.includes('503') || error.status === 503) {
                throw new Error('AI service is temporarily overloaded. Please try again in a few minutes.');
            } else if (error.message?.includes('quota') || error.message?.includes('limit')) {
                throw new Error('API quota or rate limit exceeded. Please try again later.');
            } else if (error.message?.includes('timeout')) {
                throw new Error('Request timed out. Please try again.');
            } else if (error.message?.includes('SAFETY') || error.message?.includes('safety')) {
                throw new Error('Content was blocked by safety filters. Please try rephrasing your question.');
            } else {
                throw error;
            }
        });

        console.log('AI assistant response completed:', {
            hasCandidates: !!response.candidates,
            candidateCount: response.candidates?.length,
            hasContent: !!response.candidates?.[0]?.content,
            hasParts: !!response.candidates?.[0]?.content?.parts,
            partsCount: response.candidates?.[0]?.content?.parts?.length
        });

        if (!response.candidates) {
            console.error('No candidates in response:', response);
            throw new Error('AI model returned no response candidates');
        }

        if (!response.candidates[0]) {
            console.error('No first candidate in response:', response.candidates);
            throw new Error('AI model returned empty response');
        }

        if (!response.candidates[0].content) {
            console.error('No content in first candidate:', response.candidates[0]);
            throw new Error('AI model returned no content');
        }

        if (!response.candidates[0].content.parts) {
            console.error('No parts in content:', response.candidates[0].content);
            throw new Error('AI model returned no content parts');
        }

        if (!response.candidates[0].content.parts[0]) {
            console.error('No first part in content:', response.candidates[0].content.parts);
            throw new Error('AI model returned empty content parts');
        }

        if (!response.candidates[0].content.parts[0].text) {
            console.error('No text in first part:', response.candidates[0].content.parts[0]);
            throw new Error('AI model returned no text response');
        }

        const responseText = response.candidates[0].content.parts[0].text;
        
        console.log('AI assistant output:', {
            length: responseText.length,
            preview: responseText.substring(0, 200) + '...'
        });

        // Parse commands from response if present
        let commands = null;
        let cleanResponse = responseText;
        
        const commandsMatch = responseText.match(/<COMMANDS>([\s\S]*?)<\/COMMANDS>/);
        if (commandsMatch) {
            try {
                commands = JSON.parse(commandsMatch[1].trim());
                // Remove commands from the response text
                cleanResponse = responseText.replace(/<COMMANDS>[\s\S]*?<\/COMMANDS>/, '').trim();
                console.log('Parsed commands from AI response:', commands);
            } catch (parseError) {
                console.error('Failed to parse commands from AI response:', parseError);
                // Keep the original response if command parsing fails
            }
        }

        console.log('=== GOOGLE GENAI AI ASSISTANT RESPONSE COMPLETED ===');
        return {
            response: cleanResponse,
            commands: commands
        };
    } catch (error) {
        console.error('=== GOOGLE GENAI AI ASSISTANT RESPONSE FAILED ===');
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