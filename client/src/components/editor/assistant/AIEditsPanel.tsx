import React, { useState } from 'react';
import { Check, X, Clock, Eye } from 'lucide-react';

interface AIEdit {
  id: string;
  timestamp: Date;
  description: string;
  type: 'clip_edit' | 'text_add' | 'transition_add' | 'caption_add' | 'timeline_change';
  status: 'pending' | 'accepted' | 'rejected';
  details: {
    before?: any;
    after?: any;
    changes: string[];
  };
  previewUrl?: string;
}

interface AIEditsPanelProps {
  edits: AIEdit[];
  onAcceptEdit: (editId: string) => void;
  onRejectEdit: (editId: string) => void;
  onPreviewEdit: (editId: string) => void;
  className?: string;
}

const AIEditsPanel: React.FC<AIEditsPanelProps> = ({
  edits,
  onAcceptEdit,
  onRejectEdit,
  onPreviewEdit,
  className = ''
}) => {
  const [expandedEdit, setExpandedEdit] = useState<string | null>(null);

  const getEditIcon = (type: AIEdit['type']) => {
    switch (type) {
      case 'clip_edit':
        return '✂️';
      case 'text_add':
        return '🔤';
      case 'transition_add':
        return '🎬';
      case 'caption_add':
        return '📝';
      case 'timeline_change':
        return '⏱️';
      default:
        return '🤖';
    }
  };

  const getEditTypeLabel = (type: AIEdit['type']) => {
    switch (type) {
      case 'clip_edit':
        return 'Clip Edit';
      case 'text_add':
        return 'Text Added';
      case 'transition_add':
        return 'Transition Added';
      case 'caption_add':
        return 'Captions Added';
      case 'timeline_change':
        return 'Timeline Change';
      default:
        return 'AI Edit';
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
  const recentEdits = edits.filter(edit => edit.status !== 'pending').slice(0, 5);

  if (edits.length === 0) {
    return (
      <div className={`bg-gray-50 rounded-lg p-4 ${className}`}>
        <div className="text-center text-gray-500">
          <div className="text-2xl mb-2">🤖</div>
          <div className="text-sm">No AI edits yet</div>
          <div className="text-xs text-gray-400 mt-1">
            AI edits will appear here when the assistant makes changes
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-lg ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-gray-900">AI Edits</h3>
          {pendingEdits.length > 0 && (
            <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full">
              {pendingEdits.length} pending
            </span>
          )}
        </div>
      </div>

      {/* Pending Edits */}
      {pendingEdits.length > 0 && (
        <div className="border-b border-gray-200">
          <div className="px-4 py-2 bg-blue-50 border-b border-blue-100">
            <div className="text-xs font-medium text-blue-800 uppercase tracking-wide">
              Pending Review
            </div>
          </div>
          
          {pendingEdits.map(edit => (
            <div key={edit.id} className="px-4 py-3 border-b border-gray-100 last:border-b-0">
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
                        <div className="mt-2 bg-gray-50 rounded p-2">
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
      {recentEdits.length > 0 && (
        <div>
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
            <div className="text-xs font-medium text-gray-600 uppercase tracking-wide">
              Recent Edits
            </div>
          </div>
          
          {recentEdits.map(edit => (
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

      {/* Footer */}
      {edits.length > 5 && (
        <div className="px-4 py-2 border-t border-gray-200 bg-gray-50">
          <button className="text-xs text-blue-600 hover:text-blue-800 font-medium">
            View all edits ({edits.length})
          </button>
        </div>
      )}
    </div>
  );
};

export default AIEditsPanel;
