import React, { useEffect, useRef } from 'react'

interface ConfidentialityButtonProps {
    showHelpModal: boolean;
    setShowHelpModal: React.Dispatch<React.SetStateAction<boolean>>;
}

const ConfidentialityButton = ({ showHelpModal, setShowHelpModal }: ConfidentialityButtonProps) => {

    // Refs
    const buttonRef = useRef<HTMLDivElement>(null);
    const helpModalRef = useRef<HTMLDivElement>(null);

    const handleButtonClick = () => {
        setShowHelpModal(!showHelpModal);
    }

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {

            // If the click is outside the help modal, close it
            if (buttonRef.current && !buttonRef.current.contains(event.target as Node) && helpModalRef.current && !helpModalRef.current.contains(event.target as Node)) {
                setShowHelpModal(false);
            }
        };

        if (showHelpModal) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        else {
            document.removeEventListener('mousedown', handleClickOutside);
        }

        // Cleanup the event listener on component unmount
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showHelpModal]);

    return (
        <div>
            {
                showHelpModal &&
                <div
                    onClick={(e) => e.stopPropagation()}
                    ref={helpModalRef}
                    className="absolute bottom-0 right-full mr-4 w-[200px] flex flex-col justify-center items-center gap-2 bg-white bg-opacity-20 rounded-xl px-4 py-3 backdrop-blur-md"
                >
                    <div
                        onClick={() => window.open("/privacy-policy", "_blank")}
                        className="flex flex-row gap-2 w-full bg-white bg-opacity-0 hover:bg-opacity-20 duration-500 rounded-xl px-3 py-2 cursor-pointer">
                        <img src="/assets/icons/link.png" className="w-[14px] object-contain filter invert" />
                        <p className="text-sm">
                            Privacy Policy
                        </p>
                    </div>
                    <div
                        onClick={() => window.open("/terms-of-service", "_blank")}
                        className="flex flex-row gap-2 w-full bg-white bg-opacity-0 hover:bg-opacity-20 duration-500 rounded-xl px-3 py-2 cursor-pointer">
                        <img src="/assets/icons/link.png" className="w-[14px] object-contain filter invert" />
                        <p className="text-sm">
                            Terms of Service
                        </p>
                    </div>
                </div>
            }
            <div
                ref={buttonRef}
                onClick={handleButtonClick}
                className="p-3 rounded-full bg-white bg-opacity-20 opacity-50 hover:opacity-100 duration-500 cursor-pointer"
            >
                <img src="/assets/icons/question-mark.png" className="w-[14px] object-contain filter invert" />
            </div>
        </div>
    )
}

export default ConfidentialityButton