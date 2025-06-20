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
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                        activeView === 'chat' 
                            ? 'bg-blue-100 text-blue-700 border border-blue-200 shadow-sm' 
                            : 'text-black opacity-70 hover:opacity-90 hover:bg-gray-100/70 border border-transparent'
                    }`}
                >
                    <MessageCircle className="w-4 h-4" />
                    Chat
                </button>
                <button
                    onClick={() => onViewChange('notes')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                        activeView === 'notes' 
                            ? 'bg-blue-100 text-blue-700 border border-blue-200 shadow-sm' 
                            : 'text-black opacity-70 hover:opacity-90 hover:bg-gray-100/70 border border-transparent'
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