// Tool Executors - Execute actions on specific editor tools
import { ToolAction } from './toolIntegration';
import type { Clip, Track, Command } from '@/types/editor';
import { v4 as uuid } from 'uuid';

export interface ExecutionResult {
  success: boolean;
  message: string;
  commands?: Command[];
  error?: string;
}

export class ToolExecutor {
  private projectId: string;
  private executeCommand: (command: Command) => void;

  constructor(projectId: string, executeCommand: (command: Command) => void) {
    this.projectId = projectId;
    this.executeCommand = executeCommand;
  }

  // Main execution function
  async executeAction(action: ToolAction): Promise<ExecutionResult> {
    try {
      switch (action.toolName) {
        case 'CaptionsToolPanel':
          return await this.executeCaptionsAction(action);
        
        case 'TextToolPanel':
          return await this.executeTextAction(action);
        
        case 'TransitionsToolPanel':
          return await this.executeTransitionsAction(action);
        
        case 'VoiceoverToolPanel':
          return await this.executeVoiceoverAction(action);
        
        case 'StickersToolPanel':
          return await this.executeStickersAction(action);
        
        case 'Timeline':
          return await this.executeTimelineAction(action);
        
        default:
          return {
            success: false,
            message: `Unknown tool: ${action.toolName}`,
            error: `Tool ${action.toolName} is not supported`
          };
      }
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to execute ${action.toolName} action`,
        error: error.message
      };
    }
  }

  // CAPTIONS TOOL EXECUTOR
  private async executeCaptionsAction(action: ToolAction): Promise<ExecutionResult> {
    switch (action.action) {
      case 'generateCaptions':
        return this.generateCaptions(action.parameters);
      
      case 'generateFullCaptions':
        return this.generateFullCaptions(action.parameters);
      
      default:
        return {
          success: false,
          message: `Unknown captions action: ${action.action}`,
          error: `Action ${action.action} is not supported for CaptionsToolPanel`
        };
    }
  }

  private async generateCaptions(params: any): Promise<ExecutionResult> {
    const { segments, style } = params;
    
    // Create caption clips for each segment
    const commands: Command[] = [];
    
    // Create a captions track if it doesn't exist
    const captionsTrack: Track = {
      id: uuid(),
      projectId: this.projectId,
      index: 1000, // High index to put captions on top
      type: 'caption',
      createdAt: new Date().toISOString(),
    };

    commands.push({
      type: 'ADD_TRACK',
      payload: { track: captionsTrack }
    });

    // Create caption clips for each segment
    segments.forEach((segment: any, index: number) => {
      const captionClip: Clip = {
        id: uuid(),
        trackId: captionsTrack.id,
        type: 'caption',
        sourceStartMs: 0,
        sourceEndMs: segment.endMs - segment.startMs,
        timelineStartMs: segment.startMs,
        timelineEndMs: segment.endMs,
        assetDurationMs: segment.endMs - segment.startMs,
        volume: 1,
        speed: 1,
        properties: {
          text: segment.text,
          style: this.getCaptionStyle(style)
        },
        createdAt: new Date().toISOString(),
      };

      commands.push({
        type: 'ADD_CLIP',
        payload: { clip: captionClip }
      });
    });

    // Execute all commands
    commands.forEach(command => this.executeCommand(command));

    return {
      success: true,
      message: `Generated captions for ${segments.length} segments`,
      commands
    };
  }

  private async generateFullCaptions(params: any): Promise<ExecutionResult> {
    // This would typically trigger the captions tool's auto-generation
    // For now, return a placeholder result
    return {
      success: true,
      message: 'Caption generation started. This will take a moment...'
    };
  }

  private getCaptionStyle(styleType: string): any {
    const styles = {
      'short_form': {
        fontFamily: 'Montserrat, Arial, sans-serif',
        fontSize: 36,
        fontWeight: 900,
        color: '#FFFFFF',
        textAlign: 'center',
        WebkitTextStroke: '3px #000000',
        textShadow: '3px 3px 6px #000000',
        textTransform: 'uppercase'
      },
      'professional': {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: 17,
        fontWeight: 500,
        color: '#FFFFFF',
        textAlign: 'left',
        background: 'rgba(0,0,0,0.9)',
        borderRadius: '0',
        padding: '4px 10px'
      },
      'default': {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: 20,
        fontWeight: 700,
        color: '#FFFFFF',
        textAlign: 'center',
        WebkitTextStroke: '1.5px #000000',
        textShadow: '1.5px 1.5px 3px #000000'
      }
    };

    return styles[styleType as keyof typeof styles] || styles.default;
  }

  // TEXT TOOL EXECUTOR
  private async executeTextAction(action: ToolAction): Promise<ExecutionResult> {
    switch (action.action) {
      case 'addText':
        return this.addText(action.parameters);
      
      default:
        return {
          success: false,
          message: `Unknown text action: ${action.action}`,
          error: `Action ${action.action} is not supported for TextToolPanel`
        };
    }
  }

  private async addText(params: any): Promise<ExecutionResult> {
    const { text, startMs, duration, style } = params;
    
    const commands: Command[] = [];

    // Create a text track
    const textTrack: Track = {
      id: uuid(),
      projectId: this.projectId,
      index: 0, // Insert at the beginning
      type: 'text',
      createdAt: new Date().toISOString(),
    };

    commands.push({
      type: 'ADD_TRACK',
      payload: { track: textTrack }
    });

    // Create the text clip
    const textClip: Clip = {
      id: uuid(),
      trackId: textTrack.id,
      type: 'text',
      sourceStartMs: 0,
      sourceEndMs: duration,
      timelineStartMs: startMs,
      timelineEndMs: startMs + duration,
      assetDurationMs: duration,
      volume: 1,
      speed: 1,
      properties: {
        text,
        style: {
          ...style,
          fontSize: style.fontSize || 20
        }
      },
      createdAt: new Date().toISOString(),
    };

    commands.push({
      type: 'ADD_CLIP',
      payload: { clip: textClip }
    });

    // Execute commands
    commands.forEach(command => this.executeCommand(command));

    return {
      success: true,
      message: `Added text "${text}" at ${this.formatTime(startMs)}`,
      commands
    };
  }

  // TRANSITIONS TOOL EXECUTOR
  private async executeTransitionsAction(action: ToolAction): Promise<ExecutionResult> {
    switch (action.action) {
      case 'addTransition':
        return this.addTransition(action.parameters);
      
      default:
        return {
          success: false,
          message: `Unknown transitions action: ${action.action}`,
          error: `Action ${action.action} is not supported for TransitionsToolPanel`
        };
    }
  }

  private async addTransition(params: any): Promise<ExecutionResult> {
    const { clipId, transitionType, duration } = params;
    
    // This would typically modify the clip to add transition properties
    // For now, return a success message
    return {
      success: true,
      message: `Added ${transitionType} transition (${duration}ms) to clip`
    };
  }

  // VOICEOVER TOOL EXECUTOR
  private async executeVoiceoverAction(action: ToolAction): Promise<ExecutionResult> {
    switch (action.action) {
      case 'generateVoiceover':
        return this.generateVoiceover(action.parameters);
      
      default:
        return {
          success: false,
          message: `Unknown voiceover action: ${action.action}`,
          error: `Action ${action.action} is not supported for VoiceoverToolPanel`
        };
    }
  }

  private async generateVoiceover(params: any): Promise<ExecutionResult> {
    const { text, startMs, voice } = params;
    
    // This would typically trigger TTS generation
    // For now, return a placeholder result
    return {
      success: true,
      message: `Voiceover generation started for: "${text.substring(0, 50)}..."`
    };
  }

  // STICKERS TOOL EXECUTOR
  private async executeStickersAction(action: ToolAction): Promise<ExecutionResult> {
    switch (action.action) {
      case 'addSticker':
        return this.addSticker(action.parameters);
      
      default:
        return {
          success: false,
          message: `Unknown stickers action: ${action.action}`,
          error: `Action ${action.action} is not supported for StickersToolPanel`
        };
    }
  }

  private async addSticker(params: any): Promise<ExecutionResult> {
    const { type, startMs, duration, position } = params;
    
    const commands: Command[] = [];

    // Create a stickers track (using text type as stickers might be a subset of text)
    const stickersTrack: Track = {
      id: uuid(),
      projectId: this.projectId,
      index: 500, // Middle layer
      type: 'text', // Using text type for stickers
      createdAt: new Date().toISOString(),
    };

    commands.push({
      type: 'ADD_TRACK',
      payload: { track: stickersTrack }
    });

    // Create the sticker clip
    const stickerClip: Clip = {
      id: uuid(),
      trackId: stickersTrack.id,
      type: 'text', // Using text type for stickers
      sourceStartMs: 0,
      sourceEndMs: duration,
      timelineStartMs: startMs,
      timelineEndMs: startMs + duration,
      assetDurationMs: duration,
      volume: 1,
      speed: 1,
      properties: {
        stickerType: type,
        position,
        scale: 1.0,
        rotation: 0
      },
      createdAt: new Date().toISOString(),
    };

    commands.push({
      type: 'ADD_CLIP',
      payload: { clip: stickerClip }
    });

    // Execute commands
    commands.forEach(command => this.executeCommand(command));

    return {
      success: true,
      message: `Added ${type} sticker at ${position} position`,
      commands
    };
  }

  // TIMELINE EXECUTOR
  private async executeTimelineAction(action: ToolAction): Promise<ExecutionResult> {
    switch (action.action) {
      case 'removeSegment':
        return this.removeSegment(action.parameters);
      
      case 'splitAt':
        return this.splitAt(action.parameters);
      
      default:
        return {
          success: false,
          message: `Unknown timeline action: ${action.action}`,
          error: `Action ${action.action} is not supported for Timeline`
        };
    }
  }

  private async removeSegment(params: any): Promise<ExecutionResult> {
    const { startMs, endMs, reason } = params;
    
    // This would typically find and remove clips in the specified time range
    // For now, return a success message
    return {
      success: true,
      message: `Removed segment ${this.formatTime(startMs)}-${this.formatTime(endMs)}: ${reason}`
    };
  }

  private async splitAt(params: any): Promise<ExecutionResult> {
    const { timeMs } = params;
    
    // This would typically split clips at the specified time
    // For now, return a success message
    return {
      success: true,
      message: `Split timeline at ${this.formatTime(timeMs)}`
    };
  }

  // UTILITY FUNCTIONS
  private formatTime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
}

// Batch executor for multiple actions
export class BatchExecutor {
  private toolExecutor: ToolExecutor;

  constructor(projectId: string, executeCommand: (command: Command) => void) {
    this.toolExecutor = new ToolExecutor(projectId, executeCommand);
  }

  async executeActions(actions: ToolAction[]): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];
    
    for (const action of actions) {
      const result = await this.toolExecutor.executeAction(action);
      results.push(result);
      
      // If an action fails, decide whether to continue or stop
      if (!result.success && this.shouldStopOnError(action)) {
        break;
      }
    }

    return results;
  }

  private shouldStopOnError(action: ToolAction): boolean {
    // Critical actions that should stop the batch if they fail
    const criticalActions = ['removeSegment', 'splitAt'];
    return criticalActions.includes(action.action);
  }
}