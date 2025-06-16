// AI Assistant System - Main orchestrator with tool integration
import { VideoAnalysisEngine, VideoSemanticJSON } from './videoAnalysis';
import { EditorCommandExecutor } from './commandExecutor';
import { CommandParser, ParsedCommand } from './commandParser';
import { ToolExecutor, BatchExecutor, ExecutionResult } from './toolExecutors';
import { ToolAction, SearchResult } from './toolIntegration';
import type { Clip, Track, Command } from '@/types/editor';

export interface AIAssistantConfig {
  projectId: string;
  accessToken?: string;
  editorContext: {
    clips: Clip[];
    tracks: Track[];
    selectedClipId: string | null;
    selectedClipIds: string[];
    executeCommand: (command: Command) => void;
    currentTime: number;
  };
}

export interface AIResponse {
  type: 'text' | 'commands' | 'suggestions' | 'search' | 'tool_actions';
  content: string;
  commands?: Command[];
  suggestions?: Array<{
    description: string;
    commands: Command[];
  }>;
  searchResults?: SearchResult[];
  toolActions?: ToolAction[];
  executionResults?: ExecutionResult[];
  parsedCommand?: ParsedCommand;
}

const AI_ASSISTANT_SYSTEM_INSTRUCTION = `
You are Melody, an AI video editing assistant with access to a semantic JSON "codebase" of the video content.

Your capabilities:
1. UNDERSTAND video content through semantic JSON analysis
2. EXECUTE editing commands through the timeline system
3. SEARCH and FIND specific content using the semantic data
4. SUGGEST intelligent edits based on content understanding
5. PERFORM batch operations efficiently

SEMANTIC JSON STRUCTURE:
- metadata: Basic video information
- scenes: Detailed scene descriptions with timing
- audio: Speech transcription and music segments  
- timeline: Current clip arrangement

AVAILABLE COMMANDS:
- CUT: Split clips at specific timestamps
- TRIM: Adjust clip start/end times
- DELETE: Remove clips
- MOVE: Reposition clips on timeline
- BATCH: Execute multiple commands together

RESPONSE FORMAT:
For text responses: Return helpful explanation
For commands: Return JSON array of Command objects
For suggestions: Return options with descriptions

EDITING PRINCIPLES:
1. Use semantic JSON to understand content context
2. Make precise cuts based on speech/scene boundaries
3. Maintain narrative flow and pacing
4. Consider visual composition when making cuts
5. Batch similar operations for efficiency

Always explain your reasoning and ask for confirmation before major changes.
`;

export class AIAssistant {
  private videoAnalysis: VideoAnalysisEngine;
  private commandExecutor: EditorCommandExecutor;
  private commandParser: CommandParser;
  private toolExecutor: ToolExecutor;
  private batchExecutor: BatchExecutor;
  private config: AIAssistantConfig;
  private semanticJSON: VideoSemanticJSON | null = null;

  constructor(config: AIAssistantConfig) {
    this.config = config;
    this.videoAnalysis = new VideoAnalysisEngine(config.projectId);
    this.commandExecutor = new EditorCommandExecutor(config.editorContext);
    
    // Initialize tool integration components
    this.commandParser = new CommandParser(null, config.editorContext.clips, config.editorContext.tracks);
    this.toolExecutor = new ToolExecutor(config.projectId, config.editorContext.executeCommand);
    this.batchExecutor = new BatchExecutor(config.projectId, config.editorContext.executeCommand);
  }

  async initialize(videoUrl?: string, mimeType?: string): Promise<void> {
    console.log('Initializing AI Assistant...');
    
    // Try to load existing semantic JSON
    this.semanticJSON = await this.videoAnalysis.loadSemanticJSON();
    
    // If no existing analysis and video provided, analyze it
    if (!this.semanticJSON && videoUrl && mimeType) {
      console.log('No existing analysis found, analyzing video...');
      this.semanticJSON = await this.videoAnalysis.analyzeVideo(videoUrl, mimeType);
    }
    
    if (this.semanticJSON) {
      console.log('AI Assistant initialized with semantic understanding');
      // Update command parser with semantic JSON
      this.commandParser.updateContext(this.semanticJSON, this.config.editorContext.clips, this.config.editorContext.tracks);
    } else {
      console.log('AI Assistant initialized without video analysis');
    }
  }

  async processUserRequest(request: string): Promise<AIResponse> {
    console.log('Processing user request:', request);
    
    // STEP 1: Parse command using local intelligence
    const parsedCommand = this.commandParser.parseCommand(request);
    console.log('Parsed command:', parsedCommand);

    // STEP 2: Handle different types of requests
    if (parsedCommand.intent === 'search_content' && parsedCommand.searchResults.length > 0) {
      // Pure search request - return results immediately
      return {
        type: 'search',
        content: parsedCommand.explanation,
        searchResults: parsedCommand.searchResults,
        parsedCommand
      };
    }

    if (parsedCommand.toolActions.length > 0) {
      // Tool actions identified - execute them
      return await this.executeToolActions(parsedCommand);
    }

    // STEP 3: Try AI first, but fall back to local responses if it fails
    try {
      return await this.processWithAI(request, parsedCommand);
    } catch (error) {
      console.log('AI processing failed, providing local response:', error);
      return this.provideLocalResponse(request, parsedCommand);
    }
  }

  private async executeToolActions(parsedCommand: ParsedCommand): Promise<AIResponse> {
    console.log('Executing tool actions:', parsedCommand.toolActions);
    
    try {
      const executionResults = await this.batchExecutor.executeActions(parsedCommand.toolActions);
      
      const successCount = executionResults.filter(r => r.success).length;
      const failureCount = executionResults.length - successCount;
      
      let content = parsedCommand.explanation;
      if (failureCount > 0) {
        content += `\n\n⚠️ ${failureCount} action(s) failed to execute.`;
      }
      
      return {
        type: 'tool_actions',
        content,
        toolActions: parsedCommand.toolActions,
        executionResults,
        searchResults: parsedCommand.searchResults,
        parsedCommand
      };
      
    } catch (error) {
      console.error('Tool execution failed:', error);
      return {
        type: 'text',
        content: `Failed to execute actions: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async processWithAI(request: string, parsedCommand: ParsedCommand): Promise<AIResponse> {
    // Create context for the AI including current state and semantic JSON
    const context = this.buildContext();
    
    try {
      console.log('Making AI request to /api/ai/assistant');
      console.log('Request payload:', {
        prompt: request,
        hasSemanticJSON: !!this.semanticJSON,
        timelineClips: context.timeline.clips.length
      });

      // Get the access token from the session
      const accessToken = this.getAccessToken();
      if (!accessToken) {
        console.warn('No access token available for AI request');
        throw new Error('Authentication required. Please refresh the page and try again.');
      }

      console.log('Access token available, making authenticated request');

      const response = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          prompt: request,
          semanticJSON: this.semanticJSON,
          currentTimeline: context.timeline,
          parsedCommand: parsedCommand
        })
      });

      console.log('AI API response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('AI API error response:', errorText);
        throw new Error(`AI request failed (${response.status}): ${response.statusText}${errorText ? ` - ${errorText}` : ''}`);
      }

      const result = await response.json();
      console.log('AI API result:', result);
      
      if (!result.response) {
        throw new Error('No response from AI assistant');
      }

      const aiResponse = this.parseAIResponse(result.response, request);
      
      // Merge with parsed command data
      return {
        ...aiResponse,
        searchResults: parsedCommand.searchResults,
        parsedCommand
      };
      
    } catch (error) {
      console.error('AI request processing failed:', error);
      
      // Provide more specific error messages
      if (error instanceof TypeError && error.message.includes('fetch')) {
        return {
          type: 'text',
          content: `🔌 Connection error: Unable to reach the AI service. Please check your internet connection and try again.`
        };
      }
      
      if (error instanceof Error && error.message.includes('401')) {
        return {
          type: 'text',
          content: `🔐 Authentication error: Please refresh the page and try again.`
        };
      }
      
      if (error instanceof Error && error.message.includes('405')) {
        return {
          type: 'text',
          content: `🚫 Service error: The AI service endpoint is not available. This might be a server configuration issue.`
        };
      }
      
      if (error instanceof Error && error.message.includes('500')) {
        return {
          type: 'text',
          content: `🛠️ Server error: The AI service is temporarily unavailable. Please try again in a moment.`
        };
      }
      
      if (error instanceof Error && error.message.includes('Authentication required')) {
        return {
          type: 'text',
          content: `🔐 Please refresh the page to authenticate and try again.`
        };
      }
      
      return {
        type: 'text',
        content: `❌ I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please try rephrasing your request or check the console for more details.`
      };
    }
  }

  private buildContext(): any {
    return {
      timeline: {
        clips: this.config.editorContext.clips.map(clip => ({
          id: clip.id,
          type: clip.type,
          start_ms: clip.timelineStartMs,
          end_ms: clip.timelineEndMs,
          duration_ms: clip.timelineEndMs - clip.timelineStartMs
        })),
        selectedClips: this.config.editorContext.selectedClipIds,
        currentTime: this.config.editorContext.currentTime
      },
      semantic: this.semanticJSON ? {
        totalScenes: this.semanticJSON.scenes.length,
        totalSpeechSegments: this.semanticJSON.audio.speech.length,
        hasMusic: this.semanticJSON.audio.music.length > 0,
        duration: this.semanticJSON.metadata.duration_ms
      } : null
    };
  }

  private parseAIResponse(responseText: string, originalRequest: string): AIResponse {
    // Try to extract commands if present
    const commandMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
    
    if (commandMatch) {
      try {
        const commands = JSON.parse(commandMatch[1]);
        return {
          type: 'commands',
          content: responseText.replace(/```json[\s\S]*?```/, '').trim(),
          commands: Array.isArray(commands) ? commands : [commands]
        };
      } catch (error) {
        console.error('Failed to parse commands from AI response:', error);
      }
    }

    // Check if response contains suggestions
    if (responseText.toLowerCase().includes('suggestion') || responseText.toLowerCase().includes('option')) {
      return {
        type: 'suggestions',
        content: responseText
      };
    }

    // Default to text response
    return {
      type: 'text',
      content: responseText
    };
  }

  async findContent(query: string): Promise<Array<{scene: any, timestamp: number}>> {
    if (!this.semanticJSON) {
      throw new Error('No video analysis available');
    }

    const results: Array<{scene: any, timestamp: number}> = [];
    
    // Search through scenes
    this.semanticJSON.scenes.forEach(scene => {
      const searchText = `${scene.description} ${scene.visual} ${scene.keywords.join(' ')}`.toLowerCase();
      if (searchText.includes(query.toLowerCase())) {
        results.push({
          scene,
          timestamp: scene.start_ms
        });
      }
    });

    // Search through speech
    this.semanticJSON.audio.speech.forEach(speech => {
      if (speech.text.toLowerCase().includes(query.toLowerCase())) {
        const relatedScene = this.semanticJSON!.scenes.find(scene => 
          speech.start_ms >= scene.start_ms && speech.end_ms <= scene.end_ms
        );
        if (relatedScene) {
          results.push({
            scene: relatedScene,
            timestamp: speech.start_ms
          });
        }
      }
    });

    return results;
  }

  async executeCommands(commands: Command[]): Promise<void> {
    console.log('Executing AI-generated commands:', commands);
    
    for (const command of commands) {
      try {
        this.config.editorContext.executeCommand(command);
        this.videoAnalysis.updateWithEdit(command);
      } catch (error) {
        console.error('Failed to execute command:', command, error);
        throw error;
      }
    }
  }

  onUserEdit(editOperation: any): void {
    console.log('User made edit, updating AI understanding:', editOperation);
    this.videoAnalysis.updateWithEdit(editOperation);
    
    // Update command parser context with new timeline state
    this.commandParser.updateContext(
      this.semanticJSON, 
      this.config.editorContext.clips, 
      this.config.editorContext.tracks
    );
  }

  // Add method to search content directly
  async searchContent(query: string): Promise<SearchResult[]> {
    const parsedCommand = this.commandParser.parseCommand(`find ${query}`);
    return parsedCommand.searchResults;
  }

  // Add method to get available tool actions for a request
  getAvailableActions(request: string): ToolAction[] {
    const parsedCommand = this.commandParser.parseCommand(request);
    return parsedCommand.toolActions;
  }

  getSemanticJSON(): VideoSemanticJSON | null {
    return this.semanticJSON;
  }

  hasVideoAnalysis(): boolean {
    return this.semanticJSON !== null;
  }

  updateConfig(config: AIAssistantConfig): void {
    this.config = config;
    // Update command parser context with new timeline state
    this.commandParser.updateContext(
      this.semanticJSON, 
      this.config.editorContext.clips, 
      this.config.editorContext.tracks
    );
  }

  private provideLocalResponse(request: string, parsedCommand: ParsedCommand): AIResponse {
    const lowerRequest = request.toLowerCase();
    
    // Handle common requests locally
    if (lowerRequest.includes('help') || lowerRequest.includes('what can you do')) {
      return {
        type: 'text',
        content: `🎬 **I can help you with:**

**Content Analysis & Search:**
• Find specific scenes or moments
• Search for when someone speaks
• Locate visual elements

**Editing Operations:**
• Remove silent parts
• Cut at natural speech breaks
• Trim clips precisely
• Split clips at timestamps

**Tool Integration:**
• Add captions automatically
• Insert text overlays
• Apply transitions
• Generate voiceovers
• Add stickers and effects

**Smart Suggestions:**
• Improve pacing and flow
• Organize similar content
• Optimize for different platforms

💡 **Try asking me:**
• "Remove all silent parts"
• "Find scenes where John is speaking"
• "Add captions to this video"
• "Cut this clip at natural breaks"
• "Add a fade transition between clips"

*Note: Some advanced features require video analysis. Upload a video to unlock full AI capabilities!*`
      };
    }

    if (lowerRequest.includes('analyze') || lowerRequest.includes('analysis')) {
      return {
        type: 'text',
        content: `🧠 **Video Analysis**

To analyze your video and unlock intelligent editing features:

1. **Upload a video** to your project
2. I'll automatically analyze the content to understand:
   • Scene descriptions and timing
   • Speech transcription
   • Visual composition
   • Music and audio elements

3. **Once analyzed**, I can help with:
   • Precise content search
   • Intelligent editing suggestions
   • Automated editing operations

${!this.hasVideoAnalysis() ? '📹 **No video analysis available yet.** Upload a video to get started!' : '✅ **Video analysis complete!** I understand your content and can help with intelligent editing.'}`
      };
    }

    if (lowerRequest.includes('caption') || lowerRequest.includes('subtitle')) {
      return {
        type: 'tool_actions',
        content: `📝 **Adding Captions**

I can help you add captions to your video! Here are your options:

• **Auto-generate captions** from speech
• **Choose caption style** (short-form, professional, default)
• **Customize timing and appearance**

Would you like me to generate captions for your video?`,
        toolActions: [{
          toolName: 'CaptionsToolPanel',
          action: 'generateCaptions',
          parameters: { style: 'default' },
          description: 'Generate captions with default style'
        }]
      };
    }

    if (lowerRequest.includes('silent') || lowerRequest.includes('quiet') || lowerRequest.includes('remove silence')) {
      return {
        type: 'text',
        content: `🔇 **Removing Silent Parts**

To remove silent parts from your video, I need to:

1. **Analyze the audio** to detect silence
2. **Identify speech segments** vs quiet moments  
3. **Create precise cuts** to remove gaps

${!this.hasVideoAnalysis() ? '📹 **Video analysis required.** Please upload a video first so I can analyze the audio and detect silent parts.' : '🎵 **Ready to remove silence!** I can detect quiet moments and create smooth cuts. Would you like me to proceed?'}`
      };
    }

    // Default response for unrecognized requests
    return {
      type: 'text',
      content: `🤔 I'm not sure how to help with "${request}" right now.

**Here's what I can do:**
• Search and find content
• Add captions and text
• Apply transitions and effects
• Remove silent parts
• Provide editing suggestions

**Try asking:**
• "Help me with captions"
• "What can you do?"
• "Remove silent parts"
• "Find scenes where someone speaks"

${!this.hasVideoAnalysis() ? '\n💡 **Tip:** Upload a video to unlock advanced AI editing features!' : ''}`
    };
  }

  private getAccessToken(): string | null {
    // First try to use the provided access token from config
    if (this.config.accessToken) {
      return this.config.accessToken;
    }
    
    // Fallback: try to get the access token from various sources
    try {
      // Check if we're in a browser environment
      if (typeof window !== 'undefined') {
        // Try to get from localStorage (common pattern in Next.js apps)
        const supabaseSession = localStorage.getItem('sb-' + window.location.hostname.replace(/\./g, '-') + '-auth-token');
        if (supabaseSession) {
          const session = JSON.parse(supabaseSession);
          return session.access_token;
        }
        
        // Alternative: try to get from a global context or state
        // This would need to be injected properly in a production app
        const globalAuth = (window as any).__SUPABASE_SESSION__;
        if (globalAuth?.access_token) {
          return globalAuth.access_token;
        }
      }
    } catch (error) {
      console.error('Failed to get access token:', error);
    }
    
    return null;
  }
} 