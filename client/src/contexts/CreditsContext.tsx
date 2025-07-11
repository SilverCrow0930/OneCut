'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

interface CreditsContextType {
  credits: number;
  maxCredits: number;
  subscription: any; // TODO: Add proper type
  loading: boolean;
  error: string | null;
  refreshCredits: () => Promise<void>;
}

const CreditsContext = createContext<CreditsContextType | undefined>(undefined);

export const CreditsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session } = useAuth();
  const [credits, setCredits] = useState(0);
  const [maxCredits, setMaxCredits] = useState(0);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshCredits = async () => {
    if (!session?.access_token) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/credits', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch credits');
      }

      const data = await response.json();
      setCredits(data.credits);
      setMaxCredits(data.maxCredits);
      setSubscription(data.subscription);
      setError(null);
    } catch (err) {
      console.error('Error fetching credits:', err);
      setError('Failed to fetch credits');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshCredits();
  }, [session]);

  return (
    <CreditsContext.Provider value={{
      credits,
      maxCredits,
      subscription,
      loading,
      error,
      refreshCredits
    }}>
      {children}
    </CreditsContext.Provider>
  );
};

export const useCredits = () => {
  const context = useContext(CreditsContext);
  if (context === undefined) {
    throw new Error('useCredits must be used within a CreditsProvider');
  }
  return context;
};

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