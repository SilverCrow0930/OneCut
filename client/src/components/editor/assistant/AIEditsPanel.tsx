import React from 'react';

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

const formatTime = (ms: number): string => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

const getEditIcon = (type: string): string => {
  switch (type) {
    case 'add': return '➕';
    case 'remove': return '🗑️';
    case 'modify': return '✏️';
    case 'split': return '✂️';
    case 'merge': return '🔗';
    default: return '⚡';
  }
};

const getEditTypeColor = (type: string): string => {
  switch (type) {
    case 'add': return 'bg-green-100 text-green-700 border-green-200';
    case 'remove': return 'bg-red-100 text-red-700 border-red-200';
    case 'modify': return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'split': return 'bg-purple-100 text-purple-700 border-purple-200';
    case 'merge': return 'bg-orange-100 text-orange-700 border-orange-200';
    default: return 'bg-gray-100 text-gray-700 border-gray-200';
  }
};

const getStatusColor = (status: string): string => {
  switch (status) {
    case 'pending': return 'bg-yellow-100 text-yellow-700';
    case 'accepted': return 'bg-green-100 text-green-700';
    case 'rejected': return 'bg-red-100 text-red-700';
    default: return 'bg-gray-100 text-gray-700';
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
  const completedEdits = edits.filter(edit => edit.status !== 'pending');

  if (edits.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
            <span className="text-2xl">🤖</span>
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="text-lg font-semibold text-gray-700">
              No AI Edits Yet
            </h3>
            <p className="text-sm text-gray-500 max-w-xs leading-relaxed">
              When the AI makes edits to your video, they'll appear here for you to review and approve.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with bulk actions */}
      {pendingEdits.length > 0 && (
        <div className="flex items-center justify-between p-3 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">
              {pendingEdits.length} pending edit{pendingEdits.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onAcceptAll}
              className="px-3 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600 transition-colors"
            >
              Accept All
            </button>
            <button
              onClick={onRejectAll}
              className="px-3 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 transition-colors"
            >
              Reject All
            </button>
          </div>
        </div>
      )}

      {/* Edits List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Pending Edits */}
        {pendingEdits.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Pending Review</h4>
            <div className="space-y-2">
              {pendingEdits.map(edit => (
                <div
                  key={edit.id}
                  className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">{getEditIcon(edit.type)}</span>
                        <span className={`px-2 py-1 text-xs rounded border ${getEditTypeColor(edit.type)}`}>
                          {edit.type.toUpperCase()}
                        </span>
                        <span className="text-xs text-gray-500">
                          {edit.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 mb-2">{edit.description}</p>
                      
                      {/* Edit Details */}
                      {edit.details.target && (
                        <div className="text-xs text-gray-500 mb-2">
                          Target: {edit.details.target}
                        </div>
                      )}
                      
                      {/* Commands Preview */}
                      {edit.commands && edit.commands.length > 0 && (
                        <div className="bg-gray-50 rounded p-2 mb-2">
                          <div className="text-xs text-gray-600 mb-1">
                            {edit.commands.length} command{edit.commands.length !== 1 ? 's' : ''}:
                          </div>
                          <div className="space-y-1">
                            {edit.commands.slice(0, 3).map((cmd, index) => (
                              <div key={index} className="text-xs text-gray-500 font-mono">
                                {cmd.type}
                              </div>
                            ))}
                            {edit.commands.length > 3 && (
                              <div className="text-xs text-gray-400">
                                +{edit.commands.length - 3} more...
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex gap-1 ml-3">
                      <button
                        onClick={() => onAcceptEdit(edit.id)}
                        className="px-2 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600 transition-colors"
                        title="Accept edit"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => onRejectEdit(edit.id)}
                        className="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 transition-colors"
                        title="Reject edit"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Completed Edits */}
        {completedEdits.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Recent History</h4>
            <div className="space-y-2">
              {completedEdits.slice(0, 10).map(edit => (
                <div
                  key={edit.id}
                  className="bg-gray-50 border border-gray-100 rounded-lg p-3 opacity-75"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm opacity-75">{getEditIcon(edit.type)}</span>
                        <span className={`px-2 py-1 text-xs rounded ${getEditTypeColor(edit.type)} opacity-75`}>
                          {edit.type.toUpperCase()}
                        </span>
                        <span className={`px-2 py-1 text-xs rounded ${getStatusColor(edit.status)}`}>
                          {edit.status.toUpperCase()}
                        </span>
                        <span className="text-xs text-gray-400">
                          {edit.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{edit.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIEditsPanel; 