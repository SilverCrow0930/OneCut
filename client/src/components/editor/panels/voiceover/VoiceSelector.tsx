import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface Voice {
    id: string;
    name: string;
}

interface VoiceSelectorProps {
    selectedVoice: Voice;
    onVoiceSelect: (voice: Voice) => void;
}

const VoiceSelector: React.FC<VoiceSelectorProps> = ({ selectedVoice, onVoiceSelect }) => {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    return (
        <div className="relative">
            <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 border border-gray-200 
                         rounded-xl text-left hover:bg-white hover:border-blue-200 hover:shadow-sm 
                         transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
                <span className="text-gray-700 font-medium">{selectedVoice.name}</span>
                <ChevronDown
                    className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}
                />
            </button>

            {isDropdownOpen && (
                <div className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg 
                              transform origin-top transition-all duration-200 ease-out">
                    <div className="py-1">
                        <button
                            className="w-full px-4 py-3 text-left text-gray-700 hover:bg-blue-50 hover:text-blue-600 
                                     transition-colors duration-150 first:rounded-t-xl last:rounded-b-xl"
                            onClick={() => {
                                onVoiceSelect({
                                    id: '1',
                                    name: 'Sexy Voice',
                                });
                                setIsDropdownOpen(false);
                            }}
                        >
                            Sexy Voice
                        </button>
                        <button
                            className="w-full px-4 py-3 text-left text-gray-700 hover:bg-blue-50 hover:text-blue-600 
                                     transition-colors duration-150 first:rounded-t-xl last:rounded-b-xl"
                            onClick={() => {
                                onVoiceSelect({
                                    id: '1',
                                    name: 'Eleven Multilingual V2',
                                });
                                setIsDropdownOpen(false);
                            }}
                        >
                            Eleven Multilingual V2
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VoiceSelector; 