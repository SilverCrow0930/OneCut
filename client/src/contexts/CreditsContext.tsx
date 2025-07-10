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
  
  // Credit consumption functions
  consumeCredits: (amount: number, featureName: string) => Promise<boolean>;
  consumeAiChat: () => Promise<boolean>;
  
  // Subscription management
  refreshCredits: () => Promise<void>;
  updateSubscription: (subscriptionData: any) => void;
}

const CreditsContext = createContext<CreditsContextType | undefined>(undefined);

export function CreditsProvider({ children }: { children: React.ReactNode }) {
  const { user, session, profile } = useAuth();
  const [credits, setCredits] = useState(0);
  const [maxCredits, setMaxCredits] = useState(0);
  const [subscriptionType, setSubscriptionType] = useState<'editor-plus-credits' | null>(null);
  const [aiAssistantChats, setAiAssistantChats] = useState(0);
  const [maxAiAssistantChats, setMaxAiAssistantChats] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Credit consumption rates
  const CREDIT_COSTS = {
    'ai-assistant-chat': 1,
    'smart-cut': 20,
    'ai-voiceover': 5, // per minute
    'auto-captions': 8,
    'ai-images': 3,
    'video-generation': 30, // per 5-second clip
    'background-removal': 12,
    'style-transfer': 15,
    'audio-enhancement': 6
  };

  // Fetch user's current credits and subscription
  const fetchCreditsData = async () => {
    if (!user || !profile) {
      console.log('[CreditsContext] No user or profile, skipping fetch');
      return;
    }
    
    try {
      console.log('[CreditsContext] Fetching credits data for user:', profile.id);
      const response = await fetch(apiPath('credits'), {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Cache-Control': 'no-cache'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('[CreditsContext] Received credits data:', data);
        
        // Log state updates
        console.log('[CreditsContext] Updating state with:', {
          currentCredits: data.currentCredits,
          maxCredits: data.maxCredits,
          subscriptionType: data.subscriptionType,
          aiAssistantChats: data.aiAssistantChats,
          maxAiAssistantChats: data.maxAiAssistantChats
        });
        
        setCredits(data.currentCredits);
        setMaxCredits(data.maxCredits);
        setSubscriptionType(data.subscriptionType);
        setAiAssistantChats(data.aiAssistantChats);
        setMaxAiAssistantChats(data.maxAiAssistantChats);
      } else {
        const errorText = await response.text();
        console.error('[CreditsContext] Failed to fetch credits. Status:', response.status, 'Error:', errorText);
      }
    } catch (error) {
      console.error('[CreditsContext] Error fetching credits:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Consume credits for AI features
  const consumeCredits = async (amount: number, featureName: string): Promise<boolean> => {
    if (!user || !profile) return false;
    
    // Check if user has enough credits
    if (credits < amount) {
      console.warn(`Insufficient credits: ${credits} < ${amount}`);
      return false;
    }
    
    try {
      const response = await fetch(apiPath('credits/consume'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          amount,
          featureName,
          userId: profile.id // Use profile.id instead of user.id
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setCredits(data.remainingCredits);
        
        // Log usage for analytics
        console.log(`✅ Consumed ${amount} credits for ${featureName}. Remaining: ${data.remainingCredits}`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to consume credits:', error);
      return false;
    }
  };

  // Consume AI assistant chat (unlimited for all plans now)
  const consumeAiChat = async (): Promise<boolean> => {
    if (!user || !profile) return false;
    
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
  const updateSubscription = (subscriptionData: any) => {
    setSubscriptionType(subscriptionData.type);
    setMaxCredits(subscriptionData.maxCredits);
    setMaxAiAssistantChats(subscriptionData.maxAiAssistantChats);
    // Credits and chats will be refreshed on next fetch
  };

  useEffect(() => {
    fetchCreditsData();
  }, [user, profile]); // Add profile to dependencies

  const value = {
    credits,
    maxCredits,
    subscriptionType,
    aiAssistantChats,
    maxAiAssistantChats,
    isLoading,
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
    'ai-assistant-chat': 1,
    'smart-cut': 20,
    'ai-voiceover': 5,
    'auto-captions': 8,
    'ai-images': 3,
    'video-generation': 30,
    'background-removal': 12,
    'style-transfer': 15,
    'audio-enhancement': 6
  };

  // AI assistant is unlimited for all plans now
  if (featureName === 'ai-assistant-chat') {
    return true;
  }

  // For other features, check credits
  const cost = CREDIT_COSTS[featureName as keyof typeof CREDIT_COSTS] || 0;
  return credits >= cost;
};

export const getFeatureCost = (featureName: string): number => {
  const CREDIT_COSTS = {
    'ai-assistant-chat': 1,
    'smart-cut': 20,
    'ai-voiceover': 5,
    'auto-captions': 8,
    'ai-images': 3,
    'video-generation': 30,
    'background-removal': 12,
    'style-transfer': 15,
    'audio-enhancement': 6
  };

  return CREDIT_COSTS[featureName as keyof typeof CREDIT_COSTS] || 0;
}; 