import React, { useState, useRef, useEffect } from 'react';
import { 
  Check, 
  X, 
  Clock, 
  Eye
} from 'lucide-react';
import { 
  EnhancedAssistantProps, 
  ToolMention, 
  AIEdit, 
  ChatMessage, 
  AVAILABLE_TOOLS 
} from './types';
import AdvancedChatInput from './AdvancedChatInput';

const EnhancedAssistant: React.FC<EnhancedAssistantProps> = ({
  onSendMessage,
  onAcceptEdit,
  onRejectEdit,
  onPreviewEdit,
  messages,
  edits,
  isLoading = false
}) => {
  // Chat input state - simplified since AdvancedChatInput handles most of this
  const [message, setMessage] = useState('');
  
  // UI state
  const [activeTab, setActiveTab] = useState<'chat' | 'edits'>('chat');
  const [expandedEdit, setExpandedEdit] = useState<string | null>(null);
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Helper functions for edits
  const getEditIcon = (type: AIEdit['type']) => {
    switch (type) {
      case 'clip_edit': return '✂️';
      case 'text_add': return '🔤';
      case 'transition_add': return '🎬';
      case 'caption_add': return '📝';
      case 'timeline_change': return '⏱️';
      default: return '🤖';
    }
  };

  const getEditTypeLabel = (type: AIEdit['type']) => {
    switch (type) {
      case 'clip_edit': return 'Clip Edit';
      case 'text_add': return 'Text Added';
      case 'transition_add': return 'Transition Added';
      case 'caption_add': return 'Captions Added';
      case 'timeline_change': return 'Timeline Change';
      default: return 'AI Edit';
    }
  };

  const formatTimeAgo = (timestamp: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return timestamp.toLocaleDateString();
  };

  const pendingEdits = edits.filter(edit => edit.status === 'pending');

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header with tabs */}
      <div className="border-b border-gray-200">
        <div className="flex">
          <button
            onClick={() => setActiveTab('chat')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'chat'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Chat
          </button>
          <button
            onClick={() => setActiveTab('edits')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors relative ${
              activeTab === 'edits'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            AI Edits
            {pendingEdits.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {pendingEdits.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'chat' ? (
          <div className="flex flex-col h-full">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      msg.sender === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    <div className="text-sm">{msg.content}</div>
                    {msg.mentions && msg.mentions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {msg.mentions.map((mention) => (
                          <span
                            key={mention.id}
                            className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded"
                          >
                            <span>{mention.icon}</span>
                            <span>{mention.name}</span>
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="text-xs opacity-70 mt-1">
                      {formatTimeAgo(msg.timestamp)}
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-lg px-4 py-2">
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                      <span className="text-sm text-gray-600">AI is thinking...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Advanced Chat Input */}
            <div className="border-t border-gray-200">
              <AdvancedChatInput
                onSend={onSendMessage}
                message={message}
                setMessage={setMessage}
                disabled={isLoading}
              />
            </div>
          </div>
        ) : (
          /* AI Edits Panel */
          <div className="h-full overflow-y-auto">
            {edits.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-gray-500">
                  <div className="text-4xl mb-4">🤖</div>
                  <div className="text-lg font-medium mb-2">No AI edits yet</div>
                  <div className="text-sm text-gray-400">
                    AI edits will appear here when the assistant makes changes
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 space-y-4">
                {/* Pending Edits */}
                {pendingEdits.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="px-4 py-3 border-b border-blue-200">
                      <h3 className="font-medium text-blue-900">Pending Review</h3>
                    </div>
                    
                    {pendingEdits.map(edit => (
                      <div key={edit.id} className="px-4 py-3 border-b border-blue-100 last:border-b-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-lg">{getEditIcon(edit.type)}</span>
                              <span className="text-sm font-medium text-gray-900">
                                {getEditTypeLabel(edit.type)}
                              </span>
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatTimeAgo(edit.timestamp)}
                              </span>
                            </div>
                            
                            <p className="text-sm text-gray-600 mb-2">{edit.description}</p>
                            
                            {/* Changes List */}
                            {edit.details.changes.length > 0 && (
                              <div className="mb-3">
                                <button
                                  onClick={() => setExpandedEdit(expandedEdit === edit.id ? null : edit.id)}
                                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                                >
                                  {expandedEdit === edit.id ? 'Hide' : 'Show'} details
                                </button>
                                
                                {expandedEdit === edit.id && (
                                  <div className="mt-2 bg-white rounded p-2">
                                    <ul className="text-xs text-gray-600 space-y-1">
                                      {edit.details.changes.map((change, index) => (
                                        <li key={index} className="flex items-start gap-1">
                                          <span className="text-gray-400">•</span>
                                          <span>{change}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 mt-3">
                          {edit.previewUrl && (
                            <button
                              onClick={() => onPreviewEdit(edit.id)}
                              className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
                            >
                              <Eye className="w-3 h-3" />
                              Preview
                            </button>
                          )}
                          
                          <button
                            onClick={() => onAcceptEdit(edit.id)}
                            className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700 transition-colors"
                          >
                            <Check className="w-3 h-3" />
                            Accept
                          </button>
                          
                          <button
                            onClick={() => onRejectEdit(edit.id)}
                            className="flex items-center gap-1 px-3 py-1 bg-red-600 text-white text-xs font-medium rounded hover:bg-red-700 transition-colors"
                          >
                            <X className="w-3 h-3" />
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Recent Edits */}
                {edits.filter(edit => edit.status !== 'pending').length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-lg">
                    <div className="px-4 py-3 border-b border-gray-200">
                      <h3 className="font-medium text-gray-900">Recent Edits</h3>
                    </div>
                    
                    {edits.filter(edit => edit.status !== 'pending').slice(0, 10).map(edit => (
                      <div key={edit.id} className="px-4 py-2 border-b border-gray-100 last:border-b-0">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-sm">{getEditIcon(edit.type)}</span>
                            <span className="text-sm text-gray-900 truncate">{edit.description}</span>
                          </div>
                          
                          <div className="flex items-center gap-2 ml-2">
                            <span className="text-xs text-gray-500">{formatTimeAgo(edit.timestamp)}</span>
                            <div className={`w-2 h-2 rounded-full ${
                              edit.status === 'accepted' ? 'bg-green-500' : 'bg-red-500'
                            }`} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default EnhancedAssistant; 