// Command Executor - Validates and executes AI-generated commands
import type { Clip, Track, Command } from '@/types/editor';

export interface EditorContext {
  clips: Clip[];
  tracks: Track[];
  selectedClipId: string | null;
  selectedClipIds: string[];
  executeCommand: (command: Command) => void;
  currentTime: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class EditorCommandExecutor {
  private editorContext: EditorContext;

  constructor(editorContext: EditorContext) {
    this.editorContext = editorContext;
  }

  validateCommand(command: Command): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    try {
      switch (command.type) {
        case 'ADD_CLIP':
          this.validateAddClip(command, result);
          break;
        case 'REMOVE_CLIP':
          this.validateRemoveClip(command, result);
          break;
        case 'UPDATE_CLIP':
          this.validateUpdateClip(command, result);
          break;
        case 'ADD_TRACK':
          this.validateAddTrack(command, result);
          break;
        case 'REMOVE_TRACK':
          this.validateRemoveTrack(command, result);
          break;
        case 'UPDATE_TRACK':
          this.validateUpdateTrack(command, result);
          break;
        case 'BATCH':
          this.validateBatchCommand(command, result);
          break;
        default:
          result.errors.push(`Unknown command type: ${(command as any).type}`);
          result.isValid = false;
      }
    } catch (error) {
      result.errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.isValid = false;
    }

    return result;
  }

  private validateAddClip(command: Extract<Command, { type: 'ADD_CLIP' }>, result: ValidationResult): void {
    const { clip } = command.payload;
    
    if (!clip.id || !clip.trackId) {
      result.errors.push('Clip must have id and trackId');
      result.isValid = false;
    }

    if (clip.timelineStartMs < 0 || clip.timelineEndMs <= clip.timelineStartMs) {
      result.errors.push('Invalid clip timing');
      result.isValid = false;
    }

    const track = this.editorContext.tracks.find(t => t.id === clip.trackId);
    if (!track) {
      result.errors.push(`Track ${clip.trackId} does not exist`);
      result.isValid = false;
    }

    const overlapping = this.editorContext.clips.find(c => 
      c.trackId === clip.trackId &&
      c.id !== clip.id &&
      !(clip.timelineEndMs <= c.timelineStartMs || clip.timelineStartMs >= c.timelineEndMs)
    );
    
    if (overlapping) {
      result.warnings.push('Clip may overlap with existing clip');
    }
  }

  private validateRemoveClip(command: Extract<Command, { type: 'REMOVE_CLIP' }>, result: ValidationResult): void {
    const { clip } = command.payload;
    
    const existingClip = this.editorContext.clips.find(c => c.id === clip.id);
    if (!existingClip) {
      result.errors.push(`Clip ${clip.id} does not exist`);
      result.isValid = false;
    }
  }

  private validateUpdateClip(command: Extract<Command, { type: 'UPDATE_CLIP' }>, result: ValidationResult): void {
    const { before, after } = command.payload;
    
    if (before.id !== after.id) {
      result.errors.push('Cannot change clip ID in update');
      result.isValid = false;
    }

    const existingClip = this.editorContext.clips.find(c => c.id === before.id);
    if (!existingClip) {
      result.errors.push(`Clip ${before.id} does not exist`);
      result.isValid = false;
    }

    if (after.timelineStartMs < 0 || after.timelineEndMs <= after.timelineStartMs) {
      result.errors.push('Invalid clip timing in update');
      result.isValid = false;
    }

    if (after.speed < 0.1 || after.speed > 10) {
      result.errors.push('Speed must be between 0.1 and 10');
      result.isValid = false;
    }

    if (after.volume < 0 || after.volume > 2) {
      result.errors.push('Volume must be between 0 and 2');
      result.isValid = false;
    }
  }

  private validateAddTrack(command: Extract<Command, { type: 'ADD_TRACK' }>, result: ValidationResult): void {
    const { track } = command.payload;
    
    if (!track.id || !track.projectId) {
      result.errors.push('Track must have id and projectId');
      result.isValid = false;
    }

    const existingTrack = this.editorContext.tracks.find(t => t.id === track.id);
    if (existingTrack) {
      result.errors.push(`Track ${track.id} already exists`);
      result.isValid = false;
    }
  }

  private validateRemoveTrack(command: Extract<Command, { type: 'REMOVE_TRACK' }>, result: ValidationResult): void {
    const { track } = command.payload;
    
    const existingTrack = this.editorContext.tracks.find(t => t.id === track.id);
    if (!existingTrack) {
      result.errors.push(`Track ${track.id} does not exist`);
      result.isValid = false;
    }

    const trackClips = this.editorContext.clips.filter(c => c.trackId === track.id);
    if (trackClips.length > 0) {
      result.warnings.push(`Removing track will also remove ${trackClips.length} clips`);
    }
  }

  private validateUpdateTrack(command: Extract<Command, { type: 'UPDATE_TRACK' }>, result: ValidationResult): void {
    const { before, after } = command.payload;
    
    if (before.id !== after.id) {
      result.errors.push('Cannot change track ID in update');
      result.isValid = false;
    }

    const existingTrack = this.editorContext.tracks.find(t => t.id === before.id);
    if (!existingTrack) {
      result.errors.push(`Track ${before.id} does not exist`);
      result.isValid = false;
    }
  }

  private validateBatchCommand(command: Extract<Command, { type: 'BATCH' }>, result: ValidationResult): void {
    const { commands } = command.payload;
    
    if (!Array.isArray(commands) || commands.length === 0) {
      result.errors.push('Batch command must contain array of commands');
      result.isValid = false;
      return;
    }

    commands.forEach((subCommand, index) => {
      const subResult = this.validateCommand(subCommand);
      if (!subResult.isValid) {
        result.errors.push(`Batch command ${index}: ${subResult.errors.join(', ')}`);
        result.isValid = false;
      }
      result.warnings.push(...subResult.warnings.map(w => `Batch command ${index}: ${w}`));
    });
  }

  executeCommand(command: Command): ValidationResult {
    console.log('Validating command before execution:', command);
    
    const validation = this.validateCommand(command);
    
    if (!validation.isValid) {
      console.error('Command validation failed:', validation.errors);
      throw new Error(`Command validation failed: ${validation.errors.join(', ')}`);
    }

    if (validation.warnings.length > 0) {
      console.warn('Command validation warnings:', validation.warnings);
    }

    try {
      this.editorContext.executeCommand(command);
      console.log('Command executed successfully');
      return validation;
    } catch (error) {
      console.error('Command execution failed:', error);
      throw new Error(`Command execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  executeBatch(commands: Command[]): ValidationResult[] {
    console.log('Executing batch commands:', commands.length);
    
    const results: ValidationResult[] = [];
    
    for (let i = 0; i < commands.length; i++) {
      try {
        const result = this.executeCommand(commands[i]);
        results.push(result);
      } catch (error) {
        console.error(`Batch command ${i} failed:`, error);
        throw new Error(`Batch execution failed at command ${i}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    console.log('Batch execution completed successfully');
    return results;
  }

  findClipById(clipId: string): Clip | undefined {
    return this.editorContext.clips.find(c => c.id === clipId);
  }

  findTrackById(trackId: string): Track | undefined {
    return this.editorContext.tracks.find(t => t.id === trackId);
  }

  getClipsInTimeRange(startMs: number, endMs: number): Clip[] {
    return this.editorContext.clips.filter(clip =>
      !(clip.timelineEndMs <= startMs || clip.timelineStartMs >= endMs)
    );
  }

  getSelectedClips(): Clip[] {
    if (this.editorContext.selectedClipId) {
      const clip = this.findClipById(this.editorContext.selectedClipId);
      return clip ? [clip] : [];
    }
    
    return this.editorContext.clips.filter(clip =>
      this.editorContext.selectedClipIds.includes(clip.id)
    );
  }
} 