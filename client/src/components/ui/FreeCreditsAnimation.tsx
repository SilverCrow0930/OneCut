import React, { useState, useEffect } from 'react';
import { Zap, Gift, Clock } from 'lucide-react';

interface FreeCreditsAnimationProps {
  onClose?: () => void;
  autoClose?: boolean;
  autoCloseTime?: number;
}

const FreeCreditsAnimation: React.FC<FreeCreditsAnimationProps> = ({
  onClose,
  autoClose = true,
  autoCloseTime = 10000 // 10 seconds
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [animationState, setAnimationState] = useState<'entering' | 'visible' | 'exiting'>('entering');

  useEffect(() => {
    // Start with entering animation
    setAnimationState('entering');
    
    // After a brief delay, set to visible
    const visibleTimer = setTimeout(() => {
      setAnimationState('visible');
    }, 500);

    // Auto close after specified time if enabled
    let exitTimer: NodeJS.Timeout | null = null;
    if (autoClose) {
      exitTimer = setTimeout(() => {
        setAnimationState('exiting');
        setTimeout(() => {
          setIsVisible(false);
          if (onClose) onClose();
        }, 500);
      }, autoCloseTime);
    }

    return () => {
      clearTimeout(visibleTimer);
      if (exitTimer) clearTimeout(exitTimer);
    };
  }, [autoClose, autoCloseTime, onClose]);

  const handleClose = () => {
    setAnimationState('exiting');
    setTimeout(() => {
      setIsVisible(false);
      if (onClose) onClose();
    }, 500);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
      <div 
        className={`
          bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4 pointer-events-auto
          border-2 border-emerald-500
          transform transition-all duration-500 ease-in-out
          ${animationState === 'entering' ? 'opacity-0 scale-95 translate-y-4' : ''}
          ${animationState === 'visible' ? 'opacity-100 scale-100 translate-y-0' : ''}
          ${animationState === 'exiting' ? 'opacity-0 scale-95 -translate-y-4' : ''}
        `}
      >
        {/* Close button */}
        <button 
          onClick={handleClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
        
        {/* Gift animation */}
        <div className="flex justify-center mb-4">
          <div className="relative">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center animate-pulse">
              <Gift className="w-10 h-10 text-emerald-600" />
            </div>
            <div className="absolute -top-2 -right-2 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center animate-bounce">
              <Zap className="w-5 h-5 text-white" />
            </div>
          </div>
        </div>
        
        {/* Text content */}
        <h3 className="text-2xl font-bold text-center text-gray-900 mb-2">
          <span className="bg-gradient-to-r from-emerald-500 to-blue-500 bg-clip-text text-transparent">
            20 Free AI Credits!
          </span>
        </h3>
        
        <p className="text-center text-gray-700 mb-4">
          Welcome to Lemona! We've added 20 free AI credits to your account.
        </p>
        
        <div className="bg-gray-50 rounded-xl p-4 mb-4">
          <div className="flex items-center gap-2 text-gray-700 mb-2">
            <Clock className="w-4 h-4 text-blue-500" />
            <span className="font-medium">Approximately 1 hour of Smart Cut</span>
          </div>
          <div className="flex items-center gap-2 text-gray-700">
            <Zap className="w-4 h-4 text-emerald-500" />
            <span className="font-medium">Try our AI-powered video editing</span>
          </div>
        </div>
        
        <button
          onClick={handleClose}
          className="w-full py-3 bg-gradient-to-r from-emerald-500 to-blue-500 text-white font-medium rounded-lg hover:from-emerald-600 hover:to-blue-600 transition-all duration-300"
        >
          Get Started
        </button>
      </div>
    </div>
  );
};

export default FreeCreditsAnimation; 