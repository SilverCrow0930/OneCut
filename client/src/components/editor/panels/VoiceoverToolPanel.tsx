import React, { useState } from 'react';
import { Mic } from 'lucide-react';
import PanelHeader from './PanelHeader';
import VoiceSelector from './voiceover/VoiceSelector';

interface Voice {
    id: string;
    name: string;
}

const VoiceoverToolPanel = () => {
    const [selectedVoice, setSelectedVoice] = useState<Voice>({
        id: '1',
        name: 'Eleven Multilingual V2',
    });
    const [script, setScript] = useState('');

    const handleGenerate = () => {
        // TODO: Implement script generation logic
        console.log('Generating voiceover for script:', script);
    };

    return (
        <div className="flex flex-col gap-6 p-4 bg-white rounded-lg">
            <PanelHeader icon={Mic} title="Voiceover" />
            <div className="space-y-6">
                <VoiceSelector
                    selectedVoice={selectedVoice}
                    onVoiceSelect={(voice) => {
                        setSelectedVoice(voice)
                    }}
                />
                <div className="space-y-4">
                    <div className="relative">
                        <textarea
                            value={script}
                            onChange={(e) => setScript(e.target.value)}
                            placeholder="Enter your script here..."
                            className="w-full h-40 p-4 bg-gray-50 border border-gray-200 rounded-xl shadow-sm 
                                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                                     placeholder-gray-400 text-gray-700 resize-none transition-all duration-200"
                        />
                    </div>
                    <button
                        onClick={handleGenerate}
                        className="w-full py-3 px-6 bg-gradient-to-r from-blue-500 to-blue-600 text-white 
                                 rounded-xl font-medium shadow-sm hover:shadow-md hover:from-blue-600 
                                 hover:to-blue-700 transition-all duration-200 transform hover:-translate-y-0.5"
                    >
                        Generate Script
                    </button>
                </div>
            </div>
        </div>
    );
}

export default VoiceoverToolPanel;