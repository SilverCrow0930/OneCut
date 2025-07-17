'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { apiPath } from '@/lib/config';

interface CreditsContextType {
  credits: number;
  maxCredits: number;
  subscriptionType: 'editor-plus-credits' | null;
  aiAssistantChats: number;
  maxAiAssistantChats: number;
  isLoading: boolean;
  nextBillingDate: string | null;
  cancelAt: string | null;
  
  // Credit consumption functions
  consumeCredits: (amount: number, featureName: string) => Promise<boolean>;
  consumeAiChat: () => Promise<boolean>;
  
  // Subscription management
  refreshCredits: () => Promise<void>;
  updateSubscription: (type: 'editor-plus-credits' | null) => void;
}

const CreditsContext = createContext<CreditsContextType | undefined>(undefined);

export function CreditsProvider({ children }: { children: React.ReactNode }) {
    const { user, session, isLoading: authLoading } = useAuth();
    const [credits, setCredits] = useState(0);
    const [maxCredits, setMaxCredits] = useState(0);
    const [subscriptionType, setSubscriptionType] = useState<'editor-plus-credits' | null>(null);
    const [aiAssistantChats, setAiAssistantChats] = useState(0);
    const [maxAiAssistantChats, setMaxAiAssistantChats] = useState(-1);
    const [isLoading, setIsLoading] = useState(true);
    const [nextBillingDate, setNextBillingDate] = useState<string | null>(null);
    const [cancelAt, setCancelAt] = useState<string | null>(null);

    // Credit consumption rates (per hour)
    const CREDIT_COSTS = {
      'smart-cut-audio': 20, // per hour
      'smart-cut-visual': 40, // per hour
      'ai-voiceover': 4,     // per minute
      'auto-captions': 8,    // per hour
      'ai-images': 4,        // per image
      'video-generation': 15, // per video
      'music-generation': 2   // per track
    };

    const fetchCreditsData = async () => {
        if (!user || !session?.access_token || authLoading) {
            console.log('[CreditsContext] Skipping fetch - no user or session');
            setIsLoading(false);
            return;
        }

        try {
            console.log('[CreditsContext] Fetching credits data...');
            const response = await fetch(apiPath('credits'), {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            console.log('[CreditsContext] Received credits data:', data);

            setCredits(data.currentCredits || 0);
            setMaxCredits(data.maxCredits || 0);
            setSubscriptionType(data.subscriptionType || null);
            setAiAssistantChats(data.aiAssistantChats || 0);
            setMaxAiAssistantChats(data.maxAiAssistantChats || -1);
            setNextBillingDate(data.nextBillingDate || null);
            setCancelAt(data.cancelAt || null);

        } catch (error) {
            console.error('[CreditsContext] Error fetching credits:', error);
            
            // Set defaults on error
            setCredits(0);
            setMaxCredits(0);
            setSubscriptionType(null);
            setAiAssistantChats(0);
            setMaxAiAssistantChats(-1);
            setNextBillingDate(null);
            setCancelAt(null);
        } finally {
            setIsLoading(false);
        }
    };

  // Consume credits for AI features
  const consumeCredits = async (amount: number, featureName: string): Promise<boolean> => {
    if (!user || !session?.access_token) {
      console.warn('[CreditsContext] Cannot consume credits - no user or session');
      return false;
    }

    // Check if user has enough credits
    if (credits < amount) {
      console.warn('[CreditsContext] Insufficient credits:', { required: amount, available: credits });
      return false;
    }

    try {
      console.log('[CreditsContext] Consuming credits:', { amount, featureName });
      
      const response = await fetch(apiPath('credits/consume'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ amount, featureName })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[CreditsContext] Credit consumption failed:', errorData);
        return false;
      }

      const data = await response.json();
      console.log('[CreditsContext] Credit consumption successful:', data);
      
      // Update local state
      setCredits(data.remainingCredits || 0);
      
      return true;
      
    } catch (error) {
      console.error('[CreditsContext] Network error during credit consumption:', error);
      return false;
    }
  };

  // Consume AI assistant chat (unlimited for all plans now)
  const consumeAiChat = async (): Promise<boolean> => {
    if (!user) return false;
    
    // All plans now have unlimited AI assistant chats
    // No need to track consumption for AI assistant anymore
    console.log('✅ AI assistant chat used (unlimited)');
    return true;
  };

  // Refresh credits data
  const refreshCredits = async () => {
    console.log('[CreditsContext] Refreshing credits...');
    setIsLoading(true);
    await fetchCreditsData();
  };

  // Update subscription data
  const updateSubscription = (type: 'editor-plus-credits' | null) => {
    setSubscriptionType(type);
    setMaxCredits(type === 'editor-plus-credits' ? 10000 : 0); // Example max credits for editor-plus
    setMaxAiAssistantChats(type === 'editor-plus-credits' ? 1000 : -1); // Example max chats for editor-plus
    // Credits and chats will be refreshed on next fetch
  };

  // Fetch credits data when user or session changes
  useEffect(() => {
    fetchCreditsData();
  }, [user, session, authLoading]);

  const value = {
    credits,
    maxCredits,
    subscriptionType,
    aiAssistantChats,
    maxAiAssistantChats,
    isLoading,
    nextBillingDate,
    cancelAt,
    consumeCredits,
    consumeAiChat,
    refreshCredits,
    updateSubscription
  };

  return (
    <CreditsContext.Provider value={value}>
      {children}
    </CreditsContext.Provider>
  );
}

export function useCredits() {
  const context = useContext(CreditsContext);
  if (context === undefined) {
    throw new Error('useCredits must be used within a CreditsProvider');
  }
  return context;
}

// Helper functions for checking feature availability
export const canUseFeature = (featureName: string, credits: number, subscriptionType: string | null): boolean => {
  const CREDIT_COSTS = {
    'smart-cut-audio': 20, // per hour
    'smart-cut-visual': 40, // per hour
    'ai-voiceover': 4,     // per minute
    'auto-captions': 8,    // per hour
    'ai-images': 4,        // per image
    'video-generation': 15, // per video
    'music-generation': 2   // per track
  };

  // For all features, check credits
  const cost = CREDIT_COSTS[featureName as keyof typeof CREDIT_COSTS] || 0;
  return credits >= cost;
};

export const getFeatureCost = (featureName: string): number => {
  const CREDIT_COSTS = {
    'smart-cut-audio': 20, // per hour
    'smart-cut-visual': 40, // per hour
    'ai-voiceover': 4,     // per minute
    'auto-captions': 8,    // per hour
    'ai-images': 4,        // per image
    'video-generation': 15, // per video
    'music-generation': 2   // per track
  };

  return CREDIT_COSTS[featureName as keyof typeof CREDIT_COSTS] || 0;
}; 