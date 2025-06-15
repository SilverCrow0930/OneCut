import React from 'react';
import { Check, X, Clock, FileEdit, Scissors, Plus, Trash2 } from 'lucide-react';

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

interface AIEditsPanelProps {
  edits: AIEdit[];
  onAcceptEdit: (editId: string) => void;
  onRejectEdit: (editId: string) => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
}

const getEditIcon = (type: AIEdit['type']) => {
  switch (type) {
    case 'add':
      return <Plus className="w-4 h-4 text-green-600" />;
    case 'remove':
      return <Trash2 className="w-4 h-4 text-red-600" />;
    case 'modify':
      return <FileEdit className="w-4 h-4 text-blue-600" />;
    case 'split':
      return <Scissors className="w-4 h-4 text-purple-600" />;
    case 'merge':
      return <FileEdit className="w-4 h-4 text-orange-600" />;
    default:
      return <FileEdit className="w-4 h-4 text-gray-600" />;
  }
};

const getEditColor = (type: AIEdit['type']) => {
  switch (type) {
    case 'add':
      return 'border-l-green-500 bg-green-50';
    case 'remove':
      return 'border-l-red-500 bg-red-50';
    case 'modify':
      return 'border-l-blue-500 bg-blue-50';
    case 'split':
      return 'border-l-purple-500 bg-purple-50';
    case 'merge':
      return 'border-l-orange-500 bg-orange-50';
    default:
      return 'border-l-gray-500 bg-gray-50';
  }
};

const formatTimeAgo = (timestamp: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - timestamp.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);

  if (diffSeconds < 60) {
    return 'just now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else {
    return timestamp.toLocaleDateString();
  }
};

const AIEditsPanel: React.FC<AIEditsPanelProps> = ({
  edits,
  onAcceptEdit,
  onRejectEdit,
  onAcceptAll,
  onRejectAll
}) => {
  const pendingEdits = edits.filter(edit => edit.status === 'pending');
  const hasEdits = edits.length > 0;
  const hasPendingEdits = pendingEdits.length > 0;

  if (!hasEdits) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center">
        <FileEdit className="w-8 h-8 text-gray-400 mb-2" />
        <div className="text-sm text-gray-500">No recent edits</div>
        <div className="text-xs text-gray-400 mt-1">
          AI edits will appear here for review
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <FileEdit className="w-4 h-4 text-gray-600" />
          <span className="text-sm font-medium text-gray-900">AI Edits</span>
          {hasPendingEdits && (
            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">
              {pendingEdits.length} pending
            </span>
          )}
        </div>

        {/* Bulk Actions */}
        {hasPendingEdits && (
          <div className="flex items-center gap-1">
            <button
              onClick={onAcceptAll}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
              title="Accept all pending edits"
            >
              <Check className="w-3 h-3" />
              All
            </button>
            <button
              onClick={onRejectAll}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
              title="Reject all pending edits"
            >
              <X className="w-3 h-3" />
              All
            </button>
          </div>
        )}
      </div>

      {/* Edits List */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-2 p-3">
          {edits.map((edit) => (
            <div
              key={edit.id}
              className={`border-l-4 rounded-r-lg p-3 transition-all ${getEditColor(edit.type)} ${
                edit.status === 'accepted' ? 'opacity-60' : 
                edit.status === 'rejected' ? 'opacity-40' : ''
              }`}
            >
              {/* Edit Header */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {getEditIcon(edit.type)}
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">
                      {edit.description}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Clock className="w-3 h-3 text-gray-400" />
                      <span className="text-xs text-gray-500">
                        {formatTimeAgo(edit.timestamp)}
                      </span>
                      {edit.status !== 'pending' && (
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          edit.status === 'accepted' 
                            ? 'bg-green-200 text-green-800' 
                            : 'bg-red-200 text-red-800'
                        }`}>
                          {edit.status}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                {edit.status === 'pending' && (
                  <div className="flex items-center gap-1 ml-2">
                    <button
                      onClick={() => onAcceptEdit(edit.id)}
                      className="p-1 text-green-600 hover:bg-green-200 rounded transition-colors"
                      title="Accept this edit"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onRejectEdit(edit.id)}
                      className="p-1 text-red-600 hover:bg-red-200 rounded transition-colors"
                      title="Reject this edit"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Edit Details */}
              {edit.details.target && (
                <div className="text-xs text-gray-600 bg-white bg-opacity-50 rounded px-2 py-1 mt-2">
                  <span className="font-medium">Target:</span> {edit.details.target}
                </div>
              )}

              {/* Commands Preview */}
              {edit.commands && edit.commands.length > 0 && (
                <div className="mt-2">
                  <div className="text-xs text-gray-600 mb-1">
                    {edit.commands.length} command{edit.commands.length > 1 ? 's' : ''}:
                  </div>
                  <div className="space-y-1">
                    {edit.commands.slice(0, 2).map((cmd, index) => (
                      <div key={index} className="text-xs bg-white bg-opacity-50 rounded px-2 py-1">
                        {cmd.type}: {cmd.description || 'Edit operation'}
                      </div>
                    ))}
                    {edit.commands.length > 2 && (
                      <div className="text-xs text-gray-500 px-2">
                        +{edit.commands.length - 2} more...
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AIEditsPanel; 