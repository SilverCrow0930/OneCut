import React from 'react';

interface IdeationButtonProps {
    isToggled: boolean;
    onClick: (isToggled: boolean) => void;
}

const IdeationButton: React.FC<IdeationButtonProps> = ({ isToggled, onClick }) => {
    const handleClick = () => {
        onClick(!isToggled);
    };

    return (
        <button
            onClick={handleClick}
            className={`
                px-3 py-1 rounded-md text-sm transition-colors
                border
                ${isToggled
                    ? 'bg-blue-200 text-blue-700 border-blue-300'
                    : 'bg-transparent border-gray-300 hover:border-gray-400'
                }
            `}
        >
            Ideation
        </button>
    );
};

export default IdeationButton; 