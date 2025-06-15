// Tool Integration System - Connects AI to all editor tools
import { VideoSemanticJSON } from './videoAnalysis';
import type { Clip, Track, Command } from '@/types/editor';

export interface ToolAction {
  toolName: string;
  action: string;
  parameters: Record<string, any>;
  description: string;
}

export interface SearchResult {
  type: 'scene' | 'speech' | 'clip' | 'timerange';
  startMs: number;
  endMs: number;
  content: string;
  confidence: number;
  metadata?: Record<string, any>;
}

export class ToolIntegrationEngine {
  private semanticJSON: VideoSemanticJSON | null = null;
  private clips: Clip[] = [];
  private tracks: Track[] = [];

  constructor(semanticJSON: VideoSemanticJSON | null, clips: Clip[], tracks: Track[]) {
    this.semanticJSON = semanticJSON;
    this.clips = clips;
    this.tracks = tracks;
  }

  // SEARCH FUNCTIONALITY - Fast keyword search through semantic JSON
  searchContent(query: string): SearchResult[] {
    if (!this.semanticJSON) return [];

    const results: SearchResult[] = [];
    const queryLower = query.toLowerCase();
    const keywords = queryLower.split(' ').filter(word => word.length > 2);

    // Search through scenes
    this.semanticJSON.scenes.forEach(scene => {
      const searchText = `${scene.description} ${scene.visual} ${scene.keywords.join(' ')}`.toLowerCase();
      const matchScore = this.calculateMatchScore(searchText, keywords);
      
      if (matchScore > 0.3) {
        results.push({
          type: 'scene',
          startMs: scene.start_ms,
          endMs: scene.end_ms,
          content: scene.description,
          confidence: matchScore,
          metadata: {
            keywords: scene.keywords,
            speaker: scene.speaker,
            visual: scene.visual
          }
        });
      }
    });

    // Search through speech
    this.semanticJSON.audio.speech.forEach(speech => {
      const searchText = speech.text.toLowerCase();
      const matchScore = this.calculateMatchScore(searchText, keywords);
      
      if (matchScore > 0.4) {
        results.push({
          type: 'speech',
          startMs: speech.start_ms,
          endMs: speech.end_ms,
          content: speech.text,
          confidence: matchScore,
          metadata: {
            speaker: speech.speaker
          }
        });
      }
    });

    // Sort by confidence and time
    return results.sort((a, b) => b.confidence - a.confidence || a.startMs - b.startMs);
  }

  private calculateMatchScore(text: string, keywords: string[]): number {
    let score = 0;
    const words = text.split(' ');
    
    keywords.forEach(keyword => {
      if (text.includes(keyword)) {
        score += 0.3;
        // Bonus for exact word match
        if (words.includes(keyword)) {
          score += 0.2;
        }
      }
    });

    return Math.min(score, 1.0);
  }

  // TOOL INTEGRATION - Connect to specific editor tools
  generateToolActions(userRequest: string, searchResults: SearchResult[]): ToolAction[] {
    const actions: ToolAction[] = [];
    const requestLower = userRequest.toLowerCase();

    // CAPTIONS TOOL INTEGRATION
    if (this.shouldUseCaptionsTool(requestLower)) {
      actions.push(...this.generateCaptionsActions(requestLower, searchResults));
    }

    // TEXT TOOL INTEGRATION
    if (this.shouldUseTextTool(requestLower)) {
      actions.push(...this.generateTextActions(requestLower, searchResults));
    }

    // TRANSITIONS TOOL INTEGRATION
    if (this.shouldUseTransitionsTool(requestLower)) {
      actions.push(...this.generateTransitionsActions(requestLower, searchResults));
    }

    // VOICEOVER TOOL INTEGRATION
    if (this.shouldUseVoiceoverTool(requestLower)) {
      actions.push(...this.generateVoiceoverActions(requestLower, searchResults));
    }

    // STICKERS TOOL INTEGRATION
    if (this.shouldUseStickersTool(requestLower)) {
      actions.push(...this.generateStickersActions(requestLower, searchResults));
    }

    // TIMELINE MANIPULATION
    if (this.shouldManipulateTimeline(requestLower)) {
      actions.push(...this.generateTimelineActions(requestLower, searchResults));
    }

    return actions;
  }

  // CAPTIONS TOOL INTEGRATION
  private shouldUseCaptionsTool(request: string): boolean {
    const captionKeywords = [
      'caption', 'subtitle', 'transcribe', 'text overlay', 'speech to text',
      'add captions', 'generate subtitles', 'transcription'
    ];
    return captionKeywords.some(keyword => request.includes(keyword));
  }

  private generateCaptionsActions(request: string, searchResults: SearchResult[]): ToolAction[] {
    const actions: ToolAction[] = [];

    if (request.includes('generate') || request.includes('add')) {
      // Find speech segments to caption
      const speechResults = searchResults.filter(r => r.type === 'speech');
      
      if (speechResults.length > 0) {
        actions.push({
          toolName: 'CaptionsToolPanel',
          action: 'generateCaptions',
          parameters: {
            segments: speechResults.map(r => ({
              startMs: r.startMs,
              endMs: r.endMs,
              text: r.content
            })),
            style: this.determineCaptionStyle(request)
          },
          description: `Generate captions for ${speechResults.length} speech segments`
        });
      } else {
        // Generate for entire video
        actions.push({
          toolName: 'CaptionsToolPanel',
          action: 'generateFullCaptions',
          parameters: {
            style: this.determineCaptionStyle(request)
          },
          description: 'Generate captions for entire video'
        });
      }
    }

    return actions;
  }

  private determineCaptionStyle(request: string): string {
    if (request.includes('short') || request.includes('tiktok') || request.includes('reel')) {
      return 'short_form';
    }
    if (request.includes('professional') || request.includes('news')) {
      return 'professional';
    }
    return 'default';
  }

  // TEXT TOOL INTEGRATION
  private shouldUseTextTool(request: string): boolean {
    const textKeywords = [
      'add text', 'text overlay', 'title', 'heading', 'label',
      'text effect', 'typography', 'font', 'text style'
    ];
    return textKeywords.some(keyword => request.includes(keyword));
  }

  private generateTextActions(request: string, searchResults: SearchResult[]): ToolAction[] {
    const actions: ToolAction[] = [];

    // Extract text content from request
    const textMatch = request.match(/["']([^"']+)["']/) || request.match(/text\s+["']?([^"'\n]+)["']?/);
    const textContent = textMatch ? textMatch[1] : 'Sample Text';

    // Determine timing
    let startMs = 0;
    let duration = 5000; // Default 5 seconds

    if (searchResults.length > 0) {
      const firstResult = searchResults[0];
      startMs = firstResult.startMs;
      duration = Math.min(firstResult.endMs - firstResult.startMs, 10000);
    }

    actions.push({
      toolName: 'TextToolPanel',
      action: 'addText',
      parameters: {
        text: textContent,
        startMs,
        duration,
        style: this.determineTextStyle(request)
      },
      description: `Add text "${textContent}" at ${this.formatTime(startMs)}`
    });

    return actions;
  }

  private determineTextStyle(request: string): any {
    if (request.includes('title') || request.includes('heading')) {
      return { fontSize: 32, fontWeight: 'bold', textAlign: 'center' };
    }
    if (request.includes('subtitle')) {
      return { fontSize: 24, fontWeight: 'normal', textAlign: 'center' };
    }
    return { fontSize: 20, fontWeight: 'normal', textAlign: 'center' };
  }

  // TRANSITIONS TOOL INTEGRATION
  private shouldUseTransitionsTool(request: string): boolean {
    const transitionKeywords = [
      'transition', 'fade', 'cut', 'dissolve', 'wipe', 'slide',
      'smooth transition', 'effect between', 'blend'
    ];
    return transitionKeywords.some(keyword => request.includes(keyword));
  }

  private generateTransitionsActions(request: string, searchResults: SearchResult[]): ToolAction[] {
    const actions: ToolAction[] = [];

    // Find clip boundaries for transitions
    const clipBoundaries = this.findClipBoundaries();

    if (request.includes('add transitions') || request.includes('smooth')) {
      clipBoundaries.forEach((boundary, index) => {
        actions.push({
          toolName: 'TransitionsToolPanel',
          action: 'addTransition',
          parameters: {
            clipId: boundary.clipId,
            transitionType: this.determineTransitionType(request),
            duration: 500 // Default 0.5 seconds
          },
          description: `Add ${this.determineTransitionType(request)} transition at ${this.formatTime(boundary.timeMs)}`
        });
      });
    }

    return actions;
  }

  private determineTransitionType(request: string): string {
    if (request.includes('fade')) return 'fade';
    if (request.includes('slide')) return 'slide';
    if (request.includes('dissolve')) return 'dissolve';
    return 'fade'; // Default
  }

  private findClipBoundaries(): Array<{ clipId: string; timeMs: number }> {
    const boundaries: Array<{ clipId: string; timeMs: number }> = [];
    
    this.clips.forEach(clip => {
      boundaries.push({
        clipId: clip.id,
        timeMs: clip.timelineStartMs
      });
    });

    return boundaries.sort((a, b) => a.timeMs - b.timeMs);
  }

  // VOICEOVER TOOL INTEGRATION
  private shouldUseVoiceoverTool(request: string): boolean {
    const voiceoverKeywords = [
      'voiceover', 'voice over', 'narration', 'record voice',
      'add voice', 'speak', 'audio recording'
    ];
    return voiceoverKeywords.some(keyword => request.includes(keyword));
  }

  private generateVoiceoverActions(request: string, searchResults: SearchResult[]): ToolAction[] {
    const actions: ToolAction[] = [];

    // Extract text to be spoken
    const textMatch = request.match(/["']([^"']+)["']/) || request.match(/say\s+["']?([^"'\n]+)["']?/);
    const voiceText = textMatch ? textMatch[1] : '';

    if (voiceText) {
      let startMs = 0;
      if (searchResults.length > 0) {
        startMs = searchResults[0].startMs;
      }

      actions.push({
        toolName: 'VoiceoverToolPanel',
        action: 'generateVoiceover',
        parameters: {
          text: voiceText,
          startMs,
          voice: this.determineVoiceType(request)
        },
        description: `Generate voiceover: "${voiceText}" at ${this.formatTime(startMs)}`
      });
    }

    return actions;
  }

  private determineVoiceType(request: string): string {
    if (request.includes('male')) return 'male';
    if (request.includes('female')) return 'female';
    if (request.includes('professional')) return 'professional';
    return 'default';
  }

  // STICKERS TOOL INTEGRATION
  private shouldUseStickersTool(request: string): boolean {
    const stickerKeywords = [
      'sticker', 'emoji', 'icon', 'graphic', 'overlay',
      'add sticker', 'decoration', 'visual element'
    ];
    return stickerKeywords.some(keyword => request.includes(keyword));
  }

  private generateStickersActions(request: string, searchResults: SearchResult[]): ToolAction[] {
    const actions: ToolAction[] = [];

    // Extract sticker type from request
    const stickerType = this.determineStickerType(request);
    
    let startMs = 0;
    let duration = 3000; // Default 3 seconds

    if (searchResults.length > 0) {
      const firstResult = searchResults[0];
      startMs = firstResult.startMs;
      duration = Math.min(firstResult.endMs - firstResult.startMs, 5000);
    }

    actions.push({
      toolName: 'StickersToolPanel',
      action: 'addSticker',
      parameters: {
        type: stickerType,
        startMs,
        duration,
        position: this.determineStickerPosition(request)
      },
      description: `Add ${stickerType} sticker at ${this.formatTime(startMs)}`
    });

    return actions;
  }

  private determineStickerType(request: string): string {
    if (request.includes('arrow')) return 'arrow';
    if (request.includes('heart')) return 'heart';
    if (request.includes('star')) return 'star';
    if (request.includes('emoji')) return 'emoji';
    return 'general';
  }

  private determineStickerPosition(request: string): string {
    if (request.includes('top')) return 'top';
    if (request.includes('bottom')) return 'bottom';
    if (request.includes('left')) return 'left';
    if (request.includes('right')) return 'right';
    return 'center';
  }

  // TIMELINE MANIPULATION
  private shouldManipulateTimeline(request: string): boolean {
    const timelineKeywords = [
      'cut', 'trim', 'split', 'remove', 'delete', 'move',
      'rearrange', 'reorder', 'duplicate', 'copy'
    ];
    return timelineKeywords.some(keyword => request.includes(keyword));
  }

  private generateTimelineActions(request: string, searchResults: SearchResult[]): ToolAction[] {
    const actions: ToolAction[] = [];

    if (request.includes('remove') || request.includes('delete')) {
      // Remove silent parts or specific content
      if (request.includes('silent')) {
        actions.push(...this.generateRemoveSilentActions());
      } else if (searchResults.length > 0) {
        // Remove specific found content
        searchResults.forEach(result => {
          actions.push({
            toolName: 'Timeline',
            action: 'removeSegment',
            parameters: {
              startMs: result.startMs,
              endMs: result.endMs,
              reason: `Remove: ${result.content.substring(0, 50)}...`
            },
            description: `Remove segment at ${this.formatTime(result.startMs)}-${this.formatTime(result.endMs)}`
          });
        });
      }
    }

    if (request.includes('cut') || request.includes('split')) {
      searchResults.forEach(result => {
        actions.push({
          toolName: 'Timeline',
          action: 'splitAt',
          parameters: {
            timeMs: result.startMs
          },
          description: `Split at ${this.formatTime(result.startMs)}`
        });
      });
    }

    return actions;
  }

  private generateRemoveSilentActions(): ToolAction[] {
    if (!this.semanticJSON) return [];

    const actions: ToolAction[] = [];
    const speechSegments = this.semanticJSON.audio.speech;
    
    // Find gaps between speech segments (potential silent parts)
    for (let i = 0; i < speechSegments.length - 1; i++) {
      const currentEnd = speechSegments[i].end_ms;
      const nextStart = speechSegments[i + 1].start_ms;
      const gapDuration = nextStart - currentEnd;

      // If gap is longer than 2 seconds, consider it silence
      if (gapDuration > 2000) {
        actions.push({
          toolName: 'Timeline',
          action: 'removeSegment',
          parameters: {
            startMs: currentEnd,
            endMs: nextStart,
            reason: 'Remove silent segment'
          },
          description: `Remove ${(gapDuration / 1000).toFixed(1)}s silence at ${this.formatTime(currentEnd)}`
        });
      }
    }

    return actions;
  }

  // UTILITY FUNCTIONS
  private formatTime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  // UPDATE CONTEXT
  updateContext(semanticJSON: VideoSemanticJSON | null, clips: Clip[], tracks: Track[]): void {
    this.semanticJSON = semanticJSON;
    this.clips = clips;
    this.tracks = tracks;
  }
}