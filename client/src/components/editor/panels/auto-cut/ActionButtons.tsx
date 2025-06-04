import React from 'react';
import { Send, Loader2 } from 'lucide-react';

interface ActionButtonsProps {
    onCancel: () => void;
    onSubmit: () => void;
    isSubmitDisabled: boolean;
    contentType?: string;
}

export const ActionButtons: React.FC<ActionButtonsProps> = ({ onCancel, onSubmit, isSubmitDisabled, contentType }) => (
    <div className="flex justify-end gap-3 mt-6">
        <button
            onClick={onCancel}
            className="
                px-4 py-2 text-gray-600 hover:text-gray-800 
                hover:bg-gray-100 rounded-lg transition-colors
                font-medium
            "
        >
            Cancel
        </button>
        <button
            onClick={onSubmit}
            disabled={isSubmitDisabled}
            className="
                px-6 py-3 bg-blue-500 text-white rounded-lg 
                hover:bg-blue-600 transition-all
                flex items-center gap-2 shadow-sm hover:shadow-md
                active:scale-[0.98] disabled:opacity-50 
                disabled:cursor-not-allowed disabled:hover:bg-blue-500
                font-medium text-sm
            "
        >
            {
                isSubmitDisabled ? (
                    contentType ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Processing...
                        </>
                    ) : (
                        <>
                            <div className="w-4 h-4 rounded border-2 border-gray-300" />
                            Choose Content Type
                        </>
                    )
                ) : (
                    <>
                        <Send className="w-4 h-4" />
                        {contentType ? `Analyze ${contentType.charAt(0).toUpperCase() + contentType.slice(1)} Content` : 'Analyze Video'}
                    </>
                )
            }
        </button>
    </div>
); 