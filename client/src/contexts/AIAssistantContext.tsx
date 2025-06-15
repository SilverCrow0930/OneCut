// AI Assistant Context - Provides AI functionality throughout the editor
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AIAssistant, AIResponse, AIAssistantConfig } from '@/lib/ai/aiAssistant';
import { useEditor } from './EditorContext';
import { usePlayback } from './PlaybackContext';
import { useAuth } from './AuthContext';

interface AIAssistantContextType {
  assistant: AIAssistant | null;
  isInitialized: boolean;
  isAnalyzing: boolean;
  hasVideoAnalysis: boolean;
  
  // Core methods
  initializeWithVideo: (videoUrl: string, mimeType: string) => Promise<void>;
  processRequest: (request: string) => Promise<AIResponse>;
  executeAICommands: (commands: any[]) => Promise<void>;
  
  // Content search
  findContent: (query: string) => Promise<Array<{scene: any, timestamp: number}>>;
  
  // Status
  error: string | null;
  clearError: () => void;
}

const AIAssistantContext = createContext<AIAssistantContextType | undefined>(undefined);

interface AIAssistantProviderProps {
  children: ReactNode;
  projectId: string;
}

export const AIAssistantProvider: React.FC<AIAssistantProviderProps> = ({ 
  children, 
  projectId 
}) => {
  const [assistant, setAssistant] = useState<AIAssistant | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hasVideoAnalysis, setHasVideoAnalysis] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editorContext = useEditor();
  const { currentTime } = usePlayback();
  const { session } = useAuth();

  // Initialize assistant when editor context is available
  useEffect(() => {
    if (editorContext && projectId && session?.access_token && !assistant) {
      console.log('Initializing AI Assistant...');
      
      const config: AIAssistantConfig = {
        projectId,
        accessToken: session.access_token,
        editorContext: {
          clips: editorContext.clips,
          tracks: editorContext.tracks,
          selectedClipId: editorContext.selectedClipId,
          selectedClipIds: editorContext.selectedClipIds,
          executeCommand: editorContext.executeCommand,
          currentTime: currentTime
        }
      };

      const newAssistant = new AIAssistant(config);
      setAssistant(newAssistant);
      
      // Try to initialize with existing analysis
      newAssistant.initialize().then(() => {
        setIsInitialized(true);
        setHasVideoAnalysis(newAssistant.hasVideoAnalysis());
        console.log('AI Assistant initialized');
      }).catch((err) => {
        console.error('AI Assistant initialization failed:', err);
        setError(err.message);
      });
    }
  }, [editorContext, projectId, session?.access_token, currentTime]);

  // Update assistant when editor state changes
  useEffect(() => {
    if (assistant && isInitialized) {
      // Update the assistant's understanding of current state
      const config: AIAssistantConfig = {
        projectId,
        accessToken: session?.access_token,
        editorContext: {
          clips: editorContext.clips,
          tracks: editorContext.tracks,
          selectedClipId: editorContext.selectedClipId,
          selectedClipIds: editorContext.selectedClipIds,
          executeCommand: editorContext.executeCommand,
          currentTime: currentTime
        }
      };
      
      // Update assistant config
      assistant.updateConfig(config);
    }
      }, [editorContext.clips, editorContext.tracks, editorContext.selectedClipId, editorContext.selectedClipIds, currentTime, session?.access_token]);

  const initializeWithVideo = async (videoUrl: string, mimeType: string): Promise<void> => {
    if (!assistant) {
      throw new Error('Assistant not initialized');
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      console.log('Starting video analysis...');
      await assistant.initialize(videoUrl, mimeType);
      setHasVideoAnalysis(assistant.hasVideoAnalysis());
      console.log('Video analysis completed');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Video analysis failed';
      setError(errorMessage);
      console.error('Video analysis failed:', err);
      throw new Error(errorMessage);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const processRequest = async (request: string): Promise<AIResponse> => {
    if (!assistant) {
      throw new Error('Assistant not initialized');
    }

    setError(null);

    try {
      console.log('Processing AI request:', request);
      const response = await assistant.processUserRequest(request);
      console.log('AI response:', response);
      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Request processing failed';
      setError(errorMessage);
      console.error('AI request failed:', err);
      throw new Error(errorMessage);
    }
  };

  const executeAICommands = async (commands: any[]): Promise<void> => {
    if (!assistant) {
      throw new Error('Assistant not initialized');
    }

    setError(null);

    try {
      console.log('Executing AI commands:', commands);
      await assistant.executeCommands(commands);
      console.log('AI commands executed successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Command execution failed';
      setError(errorMessage);
      console.error('AI command execution failed:', err);
      throw new Error(errorMessage);
    }
  };

  const findContent = async (query: string): Promise<Array<{scene: any, timestamp: number}>> => {
    if (!assistant) {
      throw new Error('Assistant not initialized');
    }

    if (!hasVideoAnalysis) {
      throw new Error('No video analysis available');
    }

    try {
      console.log('Searching content:', query);
      const results = await assistant.findContent(query);
      console.log('Content search results:', results);
      return results;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Content search failed';
      setError(errorMessage);
      console.error('Content search failed:', err);
      throw new Error(errorMessage);
    }
  };

  const clearError = (): void => {
    setError(null);
  };

  const contextValue: AIAssistantContextType = {
    assistant,
    isInitialized,
    isAnalyzing,
    hasVideoAnalysis,
    initializeWithVideo,
    processRequest,
    executeAICommands,
    findContent,
    error,
    clearError
  };

  return (
    <AIAssistantContext.Provider value={contextValue}>
      {children}
    </AIAssistantContext.Provider>
  );
};

export const useAIAssistant = (): AIAssistantContextType => {
  const context = useContext(AIAssistantContext);
  if (context === undefined) {
    throw new Error('useAIAssistant must be used within an AIAssistantProvider');
  }
  return context;
}; 