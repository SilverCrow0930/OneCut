// Command Parser - Converts natural language to editor commands
import { ToolIntegrationEngine, ToolAction, SearchResult } from './toolIntegration';
import { VideoSemanticJSON } from './videoAnalysis';
import type { Clip, Track, Command } from '@/types/editor';

export interface ParsedCommand {
  intent: string;
  confidence: number;
  searchQuery?: string;
  toolActions: ToolAction[];
  searchResults: SearchResult[];
  explanation: string;
}

export class CommandParser {
  private toolEngine: ToolIntegrationEngine;

  constructor(semanticJSON: VideoSemanticJSON | null, clips: Clip[], tracks: Track[]) {
    this.toolEngine = new ToolIntegrationEngine(semanticJSON, clips, tracks);
  }

  // Main parsing function
  parseCommand(userInput: string): ParsedCommand {
    const normalizedInput = this.normalizeInput(userInput);
    const intent = this.detectIntent(normalizedInput);
    const confidence = this.calculateConfidence(normalizedInput, intent);

    // Extract search query if needed
    const searchQuery = this.extractSearchQuery(normalizedInput, intent);
    
    // Perform content search if query exists
    const searchResults = searchQuery ? this.toolEngine.searchContent(searchQuery) : [];

    // Generate tool actions based on intent and search results
    const toolActions = this.toolEngine.generateToolActions(normalizedInput, searchResults);

    // Generate explanation
    const explanation = this.generateExplanation(intent, searchResults, toolActions);

    return {
      intent,
      confidence,
      searchQuery,
      toolActions,
      searchResults,
      explanation
    };
  }

  private normalizeInput(input: string): string {
    return input.toLowerCase().trim();
  }

  private detectIntent(input: string): string {
    // Define intent patterns
    const intentPatterns = {
      // Content search and navigation
      'search_content': [
        'find', 'search', 'look for', 'where', 'when does', 'show me'
      ],
      
      // Timeline editing
      'remove_content': [
        'remove', 'delete', 'cut out', 'get rid of', 'eliminate'
      ],
      'split_content': [
        'split', 'cut', 'divide', 'break', 'separate'
      ],
      'trim_content': [
        'trim', 'shorten', 'crop', 'reduce'
      ],
      'move_content': [
        'move', 'relocate', 'shift', 'reposition'
      ],
      
      // Add content
      'add_captions': [
        'add captions', 'generate captions', 'create subtitles', 'transcribe'
      ],
      'add_text': [
        'add text', 'insert text', 'text overlay', 'title', 'heading'
      ],
      'add_transitions': [
        'add transitions', 'smooth transitions', 'fade between', 'blend'
      ],
      'add_voiceover': [
        'add voiceover', 'record voice', 'narration', 'voice over'
      ],
      'add_stickers': [
        'add sticker', 'insert emoji', 'add icon', 'decoration'
      ],
      
      // Batch operations
      'remove_silence': [
        'remove silence', 'remove silent parts', 'cut silence', 'remove gaps'
      ],
      'enhance_audio': [
        'enhance audio', 'improve sound', 'audio quality', 'noise reduction'
      ],
      'auto_edit': [
        'auto edit', 'automatic editing', 'smart edit', 'ai edit'
      ]
    };

    // Find the best matching intent
    let bestIntent = 'unknown';
    let maxMatches = 0;

    for (const [intent, patterns] of Object.entries(intentPatterns)) {
      const matches = patterns.filter(pattern => input.includes(pattern)).length;
      if (matches > maxMatches) {
        maxMatches = matches;
        bestIntent = intent;
      }
    }

    return bestIntent;
  }

  private calculateConfidence(input: string, intent: string): number {
    // Base confidence based on intent detection
    let confidence = intent === 'unknown' ? 0.1 : 0.7;

    // Boost confidence for specific patterns
    const specificPatterns = {
      'exact_quotes': /["']([^"']+)["']/g,
      'time_references': /\b(\d+:\d+|\d+\s*seconds?|\d+\s*minutes?)\b/g,
      'speaker_references': /\b(speaker|person|voice|says?|talks?)\b/g,
      'location_references': /\b(scene|part|section|beginning|end|middle)\b/g
    };

    for (const [pattern, regex] of Object.entries(specificPatterns)) {
      if (regex.test(input)) {
        confidence += 0.1;
      }
    }

    return Math.min(confidence, 1.0);
  }

  private extractSearchQuery(input: string, intent: string): string | undefined {
    // For search intents, extract the search terms
    if (intent === 'search_content') {
      // Remove search command words and extract the query
      const searchWords = ['find', 'search', 'look for', 'where', 'when does', 'show me'];
      let query = input;
      
      searchWords.forEach(word => {
        query = query.replace(new RegExp(`\\b${word}\\b`, 'g'), '');
      });
      
      return query.trim();
    }

    // For content-specific operations, extract relevant terms
    if (intent.includes('remove') || intent.includes('split') || intent.includes('trim')) {
      // Extract what to remove/split/trim
      const contentMatch = input.match(/(?:remove|delete|cut|split|trim)\s+(.+?)(?:\s+(?:from|at|in)|$)/);
      if (contentMatch) {
        return contentMatch[1].trim();
      }
    }

    // For adding content, extract context clues
    if (intent.startsWith('add_')) {
      // Look for location/timing clues
      const contextMatch = input.match(/(?:at|when|where|during)\s+(.+?)(?:\s|$)/);
      if (contextMatch) {
        return contextMatch[1].trim();
      }
    }

    return undefined;
  }

  private generateExplanation(intent: string, searchResults: SearchResult[], toolActions: ToolAction[]): string {
    let explanation = '';

    // Explain search results
    if (searchResults.length > 0) {
      explanation += `Found ${searchResults.length} relevant segment${searchResults.length > 1 ? 's' : ''}: `;
      explanation += searchResults.slice(0, 3).map(result => 
        `"${result.content.substring(0, 40)}..." at ${this.formatTime(result.startMs)}`
      ).join(', ');
      
      if (searchResults.length > 3) {
        explanation += ` and ${searchResults.length - 3} more`;
      }
      explanation += '. ';
    }

    // Explain tool actions
    if (toolActions.length > 0) {
      explanation += `Will perform ${toolActions.length} action${toolActions.length > 1 ? 's' : ''}: `;
      explanation += toolActions.map(action => action.description).join(', ');
    } else if (intent === 'search_content') {
      explanation += 'Search completed.';
    } else {
      explanation += 'No specific actions identified. Please provide more details.';
    }

    return explanation;
  }

  private formatTime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  // Update context when timeline changes
  updateContext(semanticJSON: VideoSemanticJSON | null, clips: Clip[], tracks: Track[]): void {
    this.toolEngine.updateContext(semanticJSON, clips, tracks);
  }
}

// Predefined command templates for common operations
export const COMMAND_TEMPLATES = {
  // Search templates
  FIND_SPEAKER: "Find all parts where {speaker} is talking",
  FIND_KEYWORD: "Find scenes containing '{keyword}'",
  FIND_TIMERANGE: "Find content between {start} and {end}",
  
  // Editing templates
  REMOVE_SILENCE: "Remove all silent parts longer than 2 seconds",
  REMOVE_CONTENT: "Remove all instances of '{content}'",
  ADD_CAPTIONS: "Generate captions for the entire video",
  ADD_TITLE: "Add title '{text}' at the beginning",
  
  // Batch operations
  SMOOTH_TRANSITIONS: "Add smooth fade transitions between all clips",
  ENHANCE_AUDIO: "Enhance audio quality and reduce background noise",
  AUTO_CUT: "Automatically remove silent parts and enhance pacing"
};

// Helper function to fill templates
export function fillTemplate(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{${key}}`, 'g'), value);
  }
  return result;
} 