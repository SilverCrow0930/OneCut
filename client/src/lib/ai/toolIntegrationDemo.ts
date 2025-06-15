// Tool Integration Demo - Shows how the system works
import { CommandParser } from './commandParser';
import { ToolIntegrationEngine } from './toolIntegration';
import { ToolExecutor } from './toolExecutors';
import { VideoSemanticJSON } from './videoAnalysis';
import type { Clip, Track } from '@/types/editor';

// Example semantic JSON for demonstration
const EXAMPLE_SEMANTIC_JSON: VideoSemanticJSON = {
  metadata: {
    duration_ms: 120000, // 2 minutes
    resolution: { width: 1920, height: 1080 },
    analyzed_at: new Date().toISOString(),
    file_id: 'demo-video-file'
  },
  scenes: [
    {
      start_ms: 0,
      end_ms: 15000,
      description: "John introduces himself and welcomes viewers to the tutorial",
      visual: "Medium shot of John sitting at desk with laptop",
      keywords: ["introduction", "welcome", "tutorial", "john"],
      speaker: "John",
      shot_type: "medium_shot",
      location: "office"
    },
    {
      start_ms: 15000,
      end_ms: 45000,
      description: "John explains the main concepts while showing slides on screen",
      visual: "Screen recording of presentation slides with John's voice",
      keywords: ["explanation", "concepts", "slides", "presentation"],
      speaker: "John",
      shot_type: "screen_recording",
      location: "presentation"
    },
    {
      start_ms: 45000,
      end_ms: 75000,
      description: "Demonstration of the software with step-by-step instructions",
      visual: "Close-up screen recording showing software interface",
      keywords: ["demonstration", "software", "tutorial", "steps"],
      speaker: "John",
      shot_type: "screen_recording",
      location: "software_demo"
    },
    {
      start_ms: 75000,
      end_ms: 90000,
      description: "John summarizes the key points and provides final thoughts",
      visual: "Medium shot of John at desk, looking directly at camera",
      keywords: ["summary", "conclusion", "key_points"],
      speaker: "John",
      shot_type: "medium_shot",
      location: "office"
    },
    {
      start_ms: 90000,
      end_ms: 120000,
      description: "Call to action asking viewers to subscribe and like the video",
      visual: "John with animated subscribe button overlay",
      keywords: ["call_to_action", "subscribe", "like", "engagement"],
      speaker: "John",
      shot_type: "medium_shot",
      location: "office"
    }
  ],
  audio: {
    speech: [
      {
        start_ms: 2000,
        end_ms: 12000,
        text: "Hi everyone, welcome to today's tutorial on video editing with AI",
        speaker: "John"
      },
      {
        start_ms: 15000,
        end_ms: 42000,
        text: "Let me explain the three main concepts you need to understand before we dive into the practical demonstration",
        speaker: "John"
      },
      {
        start_ms: 45000,
        end_ms: 72000,
        text: "Now I'll show you step by step how to use this software to create professional-looking videos",
        speaker: "John"
      },
      {
        start_ms: 75000,
        end_ms: 87000,
        text: "To summarize, the key points are semantic understanding, intelligent editing, and automated workflows",
        speaker: "John"
      },
      {
        start_ms: 92000,
        end_ms: 118000,
        text: "If you found this helpful, please subscribe to the channel and hit the like button for more AI tutorials",
        speaker: "John"
      }
    ],
    music: [
      {
        start_ms: 0,
        end_ms: 5000,
        type: "intro_music"
      },
      {
        start_ms: 115000,
        end_ms: 120000,
        type: "outro_music"
      }
    ]
  },
  timeline: {
    clips: [
      {
        id: 'clip-1',
        start_ms: 0,
        end_ms: 120000,
        type: 'video',
        source_start_ms: 0,
        source_end_ms: 120000
      }
    ]
  }
};

// Example clips and tracks
const EXAMPLE_CLIPS: Clip[] = [
  {
    id: 'clip-1',
    trackId: 'track-video',
    type: 'video',
    sourceStartMs: 0,
    sourceEndMs: 120000,
    timelineStartMs: 0,
    timelineEndMs: 120000,
    assetDurationMs: 120000,
    volume: 1,
    speed: 1,
    properties: {},
    createdAt: new Date().toISOString()
  }
];

const EXAMPLE_TRACKS: Track[] = [
  {
    id: 'track-video',
    projectId: 'demo-project',
    index: 0,
    type: 'video',
    createdAt: new Date().toISOString()
  }
];

// Demo class to show tool integration capabilities
export class ToolIntegrationDemo {
  private commandParser: CommandParser;
  private toolEngine: ToolIntegrationEngine;

  constructor() {
    this.commandParser = new CommandParser(EXAMPLE_SEMANTIC_JSON, EXAMPLE_CLIPS, EXAMPLE_TRACKS);
    this.toolEngine = new ToolIntegrationEngine(EXAMPLE_SEMANTIC_JSON, EXAMPLE_CLIPS, EXAMPLE_TRACKS);
  }

  // Demo 1: Basic Content Search
  demoContentSearch() {
    console.log('=== DEMO 1: Content Search ===');
    
    const searchQueries = [
      'find John speaking',
      'tutorial introduction',
      'software demonstration',
      'subscribe call to action'
    ];

    searchQueries.forEach(query => {
      console.log(`\nSearching for: "${query}"`);
      const results = this.toolEngine.searchContent(query);
      
      results.forEach(result => {
        console.log(`  📍 ${result.type} at ${this.formatTime(result.startMs)}-${this.formatTime(result.endMs)}`);
        console.log(`     "${result.content.substring(0, 60)}..."`);
        console.log(`     Confidence: ${Math.round(result.confidence * 100)}%`);
      });
    });
  }

  // Demo 2: Command Parsing and Tool Actions
  demoCommandParsing() {
    console.log('\n=== DEMO 2: Command Parsing ===');
    
    const userRequests = [
      'Remove all silent parts',
      'Add captions to the entire video',
      'Add title "Welcome to AI Tutorial" at the beginning',
      'Find scenes where John explains concepts',
      'Add smooth transitions between all clips',
      'Generate voiceover saying "Thanks for watching"',
      'Add a heart sticker when John says subscribe'
    ];

    userRequests.forEach(request => {
      console.log(`\nUser Request: "${request}"`);
      const parsed = this.commandParser.parseCommand(request);
      
      console.log(`  Intent: ${parsed.intent} (confidence: ${Math.round(parsed.confidence * 100)}%)`);
      console.log(`  Search Query: ${parsed.searchQuery || 'none'}`);
      console.log(`  Search Results: ${parsed.searchResults.length}`);
      console.log(`  Tool Actions: ${parsed.toolActions.length}`);
      
      if (parsed.toolActions.length > 0) {
        parsed.toolActions.forEach((action, index) => {
          console.log(`    ${index + 1}. ${action.toolName} → ${action.action}`);
          console.log(`       ${action.description}`);
        });
      }
      
      console.log(`  Explanation: ${parsed.explanation}`);
    });
  }

  // Demo 3: Tool-Specific Actions
  demoToolSpecificActions() {
    console.log('\n=== DEMO 3: Tool-Specific Actions ===');
    
    // Captions Tool Demo
    console.log('\n📝 CAPTIONS TOOL:');
    const captionActions = this.toolEngine.generateToolActions(
      'add captions for short form video',
      []
    );
    this.logActions(captionActions);

    // Text Tool Demo
    console.log('\n📄 TEXT TOOL:');
    const textActions = this.toolEngine.generateToolActions(
      'add title "AI Video Tutorial" at the beginning',
      []
    );
    this.logActions(textActions);

    // Transitions Tool Demo
    console.log('\n🎬 TRANSITIONS TOOL:');
    const transitionActions = this.toolEngine.generateToolActions(
      'add smooth fade transitions between clips',
      []
    );
    this.logActions(transitionActions);

    // Voiceover Tool Demo
    console.log('\n🎤 VOICEOVER TOOL:');
    const voiceoverActions = this.toolEngine.generateToolActions(
      'add professional voiceover saying "Welcome to our tutorial"',
      []
    );
    this.logActions(voiceoverActions);

    // Stickers Tool Demo
    console.log('\n✨ STICKERS TOOL:');
    const stickerActions = this.toolEngine.generateToolActions(
      'add heart sticker at the top when John says subscribe',
      this.toolEngine.searchContent('subscribe')
    );
    this.logActions(stickerActions);
  }

  // Demo 4: Complex Batch Operations
  demoBatchOperations() {
    console.log('\n=== DEMO 4: Batch Operations ===');
    
    const complexRequests = [
      'Remove silence and add captions',
      'Find all introduction scenes and add title overlays',
      'Enhance the tutorial with transitions and call-to-action stickers'
    ];

    complexRequests.forEach(request => {
      console.log(`\nComplex Request: "${request}"`);
      const parsed = this.commandParser.parseCommand(request);
      
      console.log(`  🔍 Found ${parsed.searchResults.length} relevant segments`);
      console.log(`  🛠️ Generated ${parsed.toolActions.length} tool actions`);
      
      // Group actions by tool
      const actionsByTool = parsed.toolActions.reduce((acc, action) => {
        if (!acc[action.toolName]) acc[action.toolName] = [];
        acc[action.toolName].push(action);
        return acc;
      }, {} as Record<string, any[]>);

      Object.entries(actionsByTool).forEach(([toolName, actions]) => {
        console.log(`    ${toolName}: ${actions.length} actions`);
        actions.forEach(action => {
          console.log(`      - ${action.description}`);
        });
      });
    });
  }

  // Demo 5: Timeline Integration
  demoTimelineIntegration() {
    console.log('\n=== DEMO 5: Timeline Integration ===');
    
    console.log('Current Timeline State:');
    console.log(`  Clips: ${EXAMPLE_CLIPS.length}`);
    console.log(`  Tracks: ${EXAMPLE_TRACKS.length}`);
    console.log(`  Duration: ${this.formatTime(120000)}`);
    
    const timelineRequests = [
      'split at 30 seconds',
      'remove the middle section',
      'move the conclusion to the beginning'
    ];

    timelineRequests.forEach(request => {
      console.log(`\nTimeline Request: "${request}"`);
      const parsed = this.commandParser.parseCommand(request);
      
      if (parsed.toolActions.length > 0) {
        parsed.toolActions.forEach(action => {
          if (action.toolName === 'Timeline') {
            console.log(`  🎬 ${action.description}`);
            console.log(`     Parameters:`, action.parameters);
          }
        });
      }
    });
  }

  // Helper methods
  private logActions(actions: any[]) {
    actions.forEach((action, index) => {
      console.log(`  ${index + 1}. ${action.description}`);
      console.log(`     Tool: ${action.toolName} → ${action.action}`);
      console.log(`     Parameters:`, JSON.stringify(action.parameters, null, 2));
    });
  }

  private formatTime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  // Run all demos
  runAllDemos() {
    console.log('🚀 TOOL INTEGRATION SYSTEM DEMO');
    console.log('=====================================');
    
    this.demoContentSearch();
    this.demoCommandParsing();
    this.demoToolSpecificActions();
    this.demoBatchOperations();
    this.demoTimelineIntegration();
    
    console.log('\n✅ Demo completed! The tool integration system can:');
    console.log('   • Search video content semantically');
    console.log('   • Parse natural language commands');
    console.log('   • Generate tool-specific actions');
    console.log('   • Execute batch operations');
    console.log('   • Integrate with timeline operations');
    console.log('   • Connect to all existing editor tools');
  }
}

// Usage example:
// const demo = new ToolIntegrationDemo();
// demo.runAllDemos();