import React from 'react'
import { MessageCircle, FileText } from 'lucide-react'

interface ChatHeaderProps {
    activeView: 'chat' | 'notes'
    onViewChange: (view: 'chat' | 'notes') => void
}

const ChatHeader: React.FC<ChatHeaderProps> = ({ activeView, onViewChange }) => {
    return (
        <div className='flex flex-row items-center w-full'>
            <div className='flex flex-row justify-center w-full gap-1'>
                <button
                    onClick={() => onViewChange('chat')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        activeView === 'chat' 
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' 
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-800'
                    }`}
                >
                    <MessageCircle className="w-4 h-4" />
                    Chat
                </button>
                <button
                    onClick={() => onViewChange('notes')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        activeView === 'notes' 
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' 
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-800'
                    }`}
                >
                    <FileText className="w-4 h-4" />
                    Notes
                </button>
            </div>
        </div>
    )
}

export default ChatHeader