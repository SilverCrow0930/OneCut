import React from 'react';
import EnhancedAssistant from '../assistant/EnhancedAssistant';
import { ChatMessage, AIEdit, ToolMention } from '../assistant/types';

/**
 * Demo component showing how to integrate the new Cursor-style AI Assistant
 * 
 * Features implemented:
 * 1. ✅ AI most recent edits with accept/reject functionality
 * 2. ✅ @ mentions with dropdown search for available tools
 * 3. ✅ Hover to delete mentioned tools
 * 4. ✅ Agent/Ask mode selection
 * 5. ✅ File upload button
 * 6. ✅ Enhanced send button
 * 
 * Usage:
 * - Replace the existing Assistant component with EnhancedAssistant
 * - Or use this demo to test the new features
 */

const CursorAssistantDemo: React.FC = () => {
  // Sample messages for demo
  const sampleMessages: ChatMessage[] = [
    {
      id: '1',
      content: 'Hello! I can help you edit your video. Try using @ to mention tools.',
      sender: 'assistant',
      timestamp: new Date(Date.now() - 300000), // 5 minutes ago
      type: 'text'
    },
    {
      id: '2',
      content: '@Captions generate captions for this video',
      sender: 'user',
      timestamp: new Date(Date.now() - 240000), // 4 minutes ago
      type: 'text',
      mentions: [{ id: 'captions', name: 'Captions Tool', description: 'Generate and edit video captions', icon: '📝' }]
    },
    {
      id: '3',
      content: 'I\'ve generated captions for your video. You can review and accept the changes in the AI Edits tab.',
      sender: 'assistant',
      timestamp: new Date(Date.now() - 180000), // 3 minutes ago
      type: 'edit'
    }
  ];

  // Sample AI edits for demo
  const sampleEdits: AIEdit[] = [
    {
      id: 'edit-1',
      timestamp: new Date(Date.now() - 180000),
      description: 'Generated captions for entire video',
      type: 'caption_add',
      status: 'pending',
      details: {
        changes: [
          'Added caption at 0:05: "Welcome to our tutorial"',
          'Added caption at 0:12: "Let\'s get started with the basics"',
          'Added caption at 0:25: "First, we need to understand the concept"'
        ]
      },
      previewUrl: '/preview/captions-1'
    },
    {
      id: 'edit-2',
      timestamp: new Date(Date.now() - 120000),
      description: 'Added fade transition between clips',
      type: 'transition_add',
      status: 'accepted',
      details: {
        changes: [
          'Added 0.5s fade transition at 0:30',
          'Added 0.5s fade transition at 1:15'
        ]
      }
    }
  ];

  // Mock handlers
  const handleSendMessage = (message: string, mode: 'agent' | 'ask', mentions: ToolMention[], files: File[]) => {
    console.log('Send message:', { message, mode, mentions, files });
    // In a real implementation, this would send the message to your AI service
  };

  const handleAcceptEdit = (editId: string) => {
    console.log('Accept edit:', editId);
    // In a real implementation, this would apply the edit to your video
  };

  const handleRejectEdit = (editId: string) => {
    console.log('Reject edit:', editId);
    // In a real implementation, this would discard the edit
  };

  const handlePreviewEdit = (editId: string) => {
    console.log('Preview edit:', editId);
    // In a real implementation, this would show a preview of the edit
  };

  return (
    <div className="w-full h-full">
      <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">
          🎬 Cursor-Style AI Assistant Demo
        </h3>
        <div className="text-sm text-blue-800 space-y-1">
          <p><strong>✅ AI Edits Panel:</strong> View and manage AI's recent edits with accept/reject</p>
          <p><strong>✅ @ Mentions:</strong> Type @ to mention tools (Captions, Text, Transitions, etc.)</p>
          <p><strong>✅ Agent/Ask Modes:</strong> Choose between automatic actions or suggestions</p>
          <p><strong>✅ File Upload:</strong> Attach files to your messages</p>
          <p><strong>✅ Enhanced UX:</strong> Cursor-like interface with tabs and status indicators</p>
        </div>
      </div>
      
      <div className="h-96 border border-gray-300 rounded-lg overflow-hidden">
        <EnhancedAssistant
          onSendMessage={handleSendMessage}
          onAcceptEdit={handleAcceptEdit}
          onRejectEdit={handleRejectEdit}
          onPreviewEdit={handlePreviewEdit}
          messages={sampleMessages}
          edits={sampleEdits}
          isLoading={false}
        />
      </div>
      
      <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <h4 className="font-semibold text-gray-900 mb-2">How to Use:</h4>
        <div className="text-sm text-gray-700 space-y-2">
          <div>
            <strong>1. @ Mentions:</strong> Type @ followed by tool name (e.g., "@Captions generate subtitles")
          </div>
          <div>
            <strong>2. Agent Mode:</strong> AI performs actions automatically after review
          </div>
          <div>
            <strong>3. Ask Mode:</strong> AI provides suggestions and guidance
          </div>
          <div>
            <strong>4. AI Edits Tab:</strong> Review and accept/reject AI's proposed changes
          </div>
          <div>
            <strong>5. File Upload:</strong> Click the paperclip icon to attach files
          </div>
        </div>
      </div>
    </div>
  );
};

export default CursorAssistantDemo; 