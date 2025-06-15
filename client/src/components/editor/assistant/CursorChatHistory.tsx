import React, { useEffect, useRef, useState } from 'react';
import ChatMessage from './ChatMessage';
import AIEditsPanel from './AIEditsPanel';

interface ChatMessage {
  id: number;
  message: string;
  sender: 'user' | 'assistant';
  type?: 'text' | 'commands' | 'suggestions' | 'analysis' | 'error' | 'search' | 'tool_actions';
  commands?: any[];
  searchResults?: any[];
  toolActions?: any[];
  executionResults?: any[];
  mode?: 'agent' | 'ask';
  mentionedTools?: string[];
  files?: File[];
}

interface AIEdit {
  id: string;
  type: 'add' | 'remove' | 'modify' | 'split' | 'merge';
  description: string;
  timestamp: Date;
  status: 'pending' | 'accepted' | 'rejected';
  details: {
    target?: string;
    before?: any;
    after?: any;
    position?: number;
  };
  commands?: any[];
}

interface CursorChatHistoryProps {
  chatMessages: ChatMessage[];
  aiEdits: AIEdit[];
  state: string;
  onExecuteCommands?: (commands: any[]) => void;
  onAcceptEdit: (editId: string) => void;
  onRejectEdit: (editId: string) => void;
  onAcceptAllEdits: () => void;
  onRejectAllEdits: () => void;
}

const getCommandDescription = (command: any): string => {
  switch (command.type) {
    case 'ADD_CLIP':
      return `Add clip: ${command.payload.clip.type} (${formatTime(command.payload.clip.timelineStartMs)} - ${formatTime(command.payload.clip.timelineEndMs)})`;
    case 'REMOVE_CLIP':
      return `Remove clip: ${command.payload.clip.id}`;
    case 'UPDATE_CLIP':
      return `Update clip: ${command.payload.before.id} (timing/properties)`;
    case 'ADD_TRACK':
      return `Add ${command.payload.track.type} track`;
    case 'REMOVE_TRACK':
      return `Remove track: ${command.payload.track.id}`;
    case 'BATCH':
      return `Batch operation: ${command.payload.commands.length} commands`;
    default:
      return `${command.type} operation`;
  }
};

const formatTime = (ms: number): string => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

const CursorChatHistory: React.FC<CursorChatHistoryProps> = ({
  chatMessages,
  aiEdits,
  state,
  onExecuteCommands,
  onAcceptEdit,
  onRejectEdit,
  onAcceptAllEdits,
  onRejectAllEdits
}) => {
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const pendingEdits = aiEdits.filter(edit => edit.status === 'pending');

  // Scroll to bottom when messages change or when state changes
  useEffect(() => {
    if (chatContainerRef.current) {
      const container = chatContainerRef.current;
      container.scrollTop = container.scrollHeight;
    }
  }, [chatMessages, state]);

  // Render the content based on the state
  function renderContent(state: string) {
    switch (state) {
      case 'generating_output':
      case 'thinking':
        return (
          <div className='flex flex-row w-full text-sm px-4 py-3 items-center bg-gray-50 rounded-lg'>
            <div className="flex flex-row items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
              <span className="text-gray-600 font-medium">Thinking</span>
            </div>
            <div className='bouncing-dots ml-2'>
              <span className="bouncing-dot"></span>
              <span className="bouncing-dot"></span>
              <span className="bouncing-dot"></span>
            </div>
          </div>
        );
      default:
        return null;
    }
  }

  const [activeTab, setActiveTab] = useState<'chat' | 'edits'>('chat');

  return (
    <div className="flex flex-col h-full">
      {/* Custom Tabs Header */}
      <div className="grid w-full grid-cols-2 mb-2 bg-gray-100 rounded-lg p-1">
        <button
          onClick={() => setActiveTab('chat')}
          className={`text-sm py-2 px-3 rounded-md transition-colors ${
            activeTab === 'chat' 
              ? 'bg-white text-gray-900 shadow-sm' 
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Chat
        </button>
        <button
          onClick={() => setActiveTab('edits')}
          className={`text-sm py-2 px-3 rounded-md transition-colors relative ${
            activeTab === 'edits' 
              ? 'bg-white text-gray-900 shadow-sm' 
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          AI Edits
          {pendingEdits.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
              {pendingEdits.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'chat' && (
        <div className="flex-1 overflow-hidden">
          <div
            ref={chatContainerRef}
            className="flex flex-col w-full h-full gap-2 pr-2 pb-4 overflow-y-auto elegant-scrollbar"
          >
            {/* Welcome message when no chat messages */}
            {chatMessages.length === 0 && state === 'idle' && (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="flex flex-col items-center gap-4">
                  {/* Welcome text */}
                  <div className="flex flex-col gap-2">
                    <h3 className="text-lg font-semibold text-gray-700">
                      🎬 AI Video Assistant
                    </h3>
                    <p className="text-sm text-gray-500 max-w-xs leading-relaxed">
                      I can help you edit your video intelligently. Use @ to mention tools, choose Agent mode for automatic actions, or Ask mode for suggestions.
                    </p>
                  </div>
                  
                  {/* Suggestion bubbles */}
                  <div className="flex flex-col gap-2 mt-2">
                    <div className="text-xs text-gray-400 font-medium">Try asking:</div>
                    <div className="flex flex-col gap-1">
                      <div className="bg-blue-50 text-blue-600 text-xs px-3 py-1 rounded-full">
                        "Remove all silent parts"
                      </div>
                      <div className="bg-purple-50 text-purple-600 text-xs px-3 py-1 rounded-full">
                        "@Captions generate captions"
                      </div>
                      <div className="bg-green-50 text-green-600 text-xs px-3 py-1 rounded-full">
                        "Add title 'Welcome' at the beginning"
                      </div>
                      <div className="bg-orange-50 text-orange-600 text-xs px-3 py-1 rounded-full">
                        "@Transitions add fade between clips"
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Chat Messages */}
            {chatMessages.map((message) => (
              <div key={message.id}>
                <div className="flex flex-col gap-1 mb-2">
                  <ChatMessage
                    id={message.id}
                    message={message.message}
                    sender={message.sender}
                  />
                  
                  {/* Show mode and mentioned tools for user messages */}
                  {message.sender === 'user' && (message.mode || message.mentionedTools?.length) && (
                    <div className="flex items-center gap-2 text-xs text-gray-500 ml-2">
                      {message.mode && (
                        <span className={`px-2 py-0.5 rounded ${
                          message.mode === 'agent' 
                            ? 'bg-purple-100 text-purple-700' 
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {message.mode}
                        </span>
                      )}
                      {message.mentionedTools?.map(tool => (
                        <span key={tool} className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                          @{tool}
                        </span>
                      ))}
                      {message.files?.length && (
                        <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded">
                          {message.files.length} file{message.files.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Render command execution buttons */}
                {message.commands && message.commands.length > 0 && onExecuteCommands && (
                  <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="text-sm text-blue-800 mb-2">
                      🎬 Editing Commands Ready ({message.commands.length} operations)
                    </div>
                    
                    <div className="space-y-1 mb-3">
                      {message.commands.map((cmd, index) => (
                        <div key={index} className="text-xs text-blue-600 bg-white px-2 py-1 rounded">
                          {getCommandDescription(cmd)}
                        </div>
                      ))}
                    </div>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={() => onExecuteCommands(message.commands!)}
                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                      >
                        Execute Commands
                      </button>
                      <button
                        className="px-3 py-1 bg-gray-300 text-gray-700 text-sm rounded hover:bg-gray-400 transition-colors"
                      >
                        Review First
                      </button>
                    </div>
                  </div>
                )}
                
                {/* Render other message types */}
                {message.type === 'analysis' && (
                  <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-sm text-green-800">
                    📊 Video Analysis Update
                  </div>
                )}
                
                {message.type === 'error' && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                    ⚠️ Error
                  </div>
                )}
                
                {/* Render search results */}
                {message.type === 'search' && message.searchResults && message.searchResults.length > 0 && (
                  <div className="mt-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                    <div className="text-sm text-purple-800 mb-2">
                      🔍 Search Results ({message.searchResults.length} found)
                    </div>
                    <div className="space-y-2">
                      {message.searchResults.slice(0, 5).map((result, index) => (
                        <div key={index} className="bg-white p-2 rounded border">
                          <div className="text-xs text-purple-600 font-medium">
                            {formatTime(result.startMs)} - {formatTime(result.endMs)}
                          </div>
                          <div className="text-sm text-gray-700 mt-1">
                            {result.content.substring(0, 100)}...
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Thinking state */}
            {renderContent(state)}
          </div>
        </div>
      )}

      {activeTab === 'edits' && (
        <div className="flex-1 overflow-hidden">
          <AIEditsPanel
            edits={aiEdits}
            onAcceptEdit={onAcceptEdit}
            onRejectEdit={onRejectEdit}
            onAcceptAll={onAcceptAllEdits}
            onRejectAll={onRejectAllEdits}
          />
        </div>
      )}
    </div>
  );
};

export default CursorChatHistory; 