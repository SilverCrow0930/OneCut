import React, { useState, useEffect } from 'react';
import { useCredits } from '@/contexts/CreditsContext';
import Link from 'next/link';

export default function CreditCounter() {
  const { credits: currentCredits, maxCredits } = useCredits();
  const [isAnimating, setIsAnimating] = useState(false);
  const [prevCredits, setPrevCredits] = useState(currentCredits);
  const [showTooltip, setShowTooltip] = useState(false);
  
  // Calculate percentage for progress bar
  const percentage = Math.min(Math.max((currentCredits / maxCredits) * 100, 0), 100);
  
  // Trigger animation when credits change
  useEffect(() => {
    if (currentCredits !== prevCredits) {
      setIsAnimating(true);
      const timer = setTimeout(() => {
        setIsAnimating(false);
        setPrevCredits(currentCredits);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [currentCredits, prevCredits]);
  
  return (
    <div className="relative" 
         onMouseEnter={() => setShowTooltip(true)}
         onMouseLeave={() => setShowTooltip(false)}>
      <Link href="/pricing" className="group">
        <div className="flex items-center bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-blue-200/50 shadow-sm hover:shadow-md transition-all duration-300 group-hover:bg-white/90">
          <div className="flex items-center">
            {/* Credit Icon */}
            <div className={`w-6 h-6 flex items-center justify-center bg-gradient-to-r from-blue-500 to-purple-500 rounded-full mr-2 shadow-inner ${isAnimating ? 'animate-pulse' : ''}`}>
              <span className="text-xs font-bold text-white">₵</span>
            </div>
            
            {/* Credit Counter */}
            <div className="flex flex-col">
              <div className="flex items-center">
                <span className={`text-sm font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent ${isAnimating ? 'animate-bounce' : ''}`}>
                  {currentCredits}
                </span>
                <span className="text-xs text-gray-500 ml-0.5">/{maxCredits}</span>
              </div>
              
              {/* Progress Bar */}
              <div className="w-16 h-1.5 bg-gray-100 rounded-full mt-0.5 overflow-hidden">
                <div 
                  className={`h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500 ease-out ${isAnimating ? 'animate-pulse' : ''}`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </Link>
      
      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-3 py-2 bg-white rounded-lg shadow-lg border border-gray-100 text-xs w-48 z-50">
          <div className="font-medium text-gray-800 mb-1">AI Credits</div>
          <div className="flex justify-between mb-1">
            <span className="text-gray-600">Available:</span>
            <span className="font-medium text-blue-600">{currentCredits} credits</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Total:</span>
            <span className="font-medium">{maxCredits} credits</span>
          </div>
          <div className="mt-2 text-center text-gray-500 text-[10px]">
            Click to manage your subscription
          </div>
          {/* Arrow */}
          <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-b-4 border-l-transparent border-r-transparent border-b-white"></div>
        </div>
      )}
    </div>
  );
} 