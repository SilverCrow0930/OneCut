// AI Assistant System - Main orchestrator with tool integration
import { VideoAnalysisEngine, VideoSemanticJSON } from './videoAnalysis';
import { EditorCommandExecutor } from './commandExecutor';
import { CommandParser, ParsedCommand } from './commandParser';
import { ToolExecutor, BatchExecutor, ExecutionResult } from './toolExecutors';
import { ToolAction, SearchResult } from './toolIntegration';
import type { Clip, Track, Command } from '@/types/editor';

export interface AIAssistantConfig {
  projectId: string;
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

    // STEP 3: Fall back to AI for complex requests
    return await this.processWithAI(request, parsedCommand);
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
      const response = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: request,
          semanticJSON: this.semanticJSON,
          currentTimeline: context.timeline,
          parsedCommand: parsedCommand
        })
      });

      if (!response.ok) {
        throw new Error(`AI request failed: ${response.statusText}`);
      }

      const result = await response.json();
      
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
      return {
        type: 'text',
        content: `I encountered an error processing your request: ${error instanceof Error ? error.message : 'Unknown error'}. Please try rephrasing your request.`
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
} 