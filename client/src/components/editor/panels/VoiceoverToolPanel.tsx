import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useEditor } from '@/contexts/EditorContext';
import { apiPath } from '@/lib/config';

interface Voice {
    id: string;
    name: string;
    avatarUrl: string;
}

const VoiceoverToolPanel = () => {

    const {
        // addClip
    } = useEditor();

    // State
    const [selectedVoice, setSelectedVoice] = useState<Voice>({
        id: '1',
        name: 'eleven_multilingual_v2',
        avatarUrl: '/api/placeholder/32/32'
    });

    // Script
    const [script, setScript] = useState('');

    // Dropdown
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    // Loading and Feedback States
    const [isLoading, setIsLoading] = useState(false);
    const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

    // Generate
    const handleGenerate = async () => {
        try {
            setIsLoading(true);
            setFeedbackMessage(null);

            const response = await fetch(`${apiPath('')}/generate-voiceover`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    voiceId: selectedVoice.id,
                    text: script,
                }),
            });

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const data = await response.json();
            console.log('Voice over generated:', data);
            // Handle the response data here (e.g., update state to display the voice over)

            // Reset the script after successful generation
            setScript('');

            // Introduce a timeout before executing success actions
            setTimeout(() => {
                // Provide feedback to the user
                setFeedbackMessage('Voice over successfully generated!');
            }, 5000); // Delay of 5000 milliseconds (5 seconds)

            // Add the voice over to the editor
            // addClip(...);
        }
        catch (error) {
            console.error('Error generating voice over:', error);
            // Handle errors here (e.g., display an error message to the user)
            setFeedbackMessage('Failed to generate voice over. Please try again.');
        }
        finally {
            // Reset loading state
            setIsLoading(false);
        }
    };

    // Handle key press in textarea
    const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); // Prevents adding a new line
            handleGenerate();
        }
    };

    return (
        <div className="flex flex-col gap-4 p-4">
            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-900">
                    Voice
                </label>
                <div className="relative">
                    <button
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className="w-full flex items-center justify-between px-4 py-2 bg-white border border-gray-200 rounded-full text-left"
                    >
                        <div className="flex items-center gap-3">
                            {/* <img
                                src={selectedVoice.avatarUrl}
                                alt=""
                                className="w-6 h-6 rounded-full"
                            /> */}
                            <span className="text-gray-900">{selectedVoice.name}</span>
                        </div>
                        <ChevronDown className="w-5 h-5 text-gray-500" />
                    </button>

                    {
                        isDropdownOpen && (
                            <div className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg">
                                {/* Dropdown items would go here */}
                                <div className="p-1">
                                    {/* Example voice options */}
                                    <button
                                        className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-100"
                                        onClick={() => {
                                            setSelectedVoice({
                                                id: '1',
                                                name: 'Sexy Voice',
                                                avatarUrl: '/api/placeholder/32/32'
                                            });
                                            setIsDropdownOpen(false);
                                        }}
                                    >
                                        <span>Sexy Voice</span>
                                    </button>
                                    <button
                                        className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-100"
                                        onClick={() => {
                                            setSelectedVoice({
                                                id: '1',
                                                name: 'Eleven Multilingual V2',
                                                avatarUrl: '/api/placeholder/32/32'
                                            });
                                            setIsDropdownOpen(false);
                                        }}
                                    >
                                        <span>Eleven Multilingual V2</span>
                                    </button>
                                    {/* Add more voice options as needed */}
                                </div>
                            </div>
                        )
                    }
                </div>
            </div>

            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-900">
                    Script
                </label>
                <textarea
                    value={script}
                    onChange={(e) => setScript(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="Type your script here"
                    className="w-full h-40 px-4 py-3 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
            </div>

            {/* Feedback Message */}
            {feedbackMessage && (
                <div className="text-sm text-center text-green-600">
                    {feedbackMessage}
                </div>
            )}

            <button
                onClick={handleGenerate}
                disabled={isLoading}
                className={`
                    w-full py-3 bg-blue-100 text-blue-600 rounded-lg font-medium 
                    hover:bg-blue-200 transition-colors 
                    ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`
                }
            >
                {isLoading ? 'Generating...' : 'Generate AI Voice Over'}
            </button>
        </div>
    );
};

export default VoiceoverToolPanel;