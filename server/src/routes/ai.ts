import express from 'express';
import { generateVideoAnalysis, generateAIAssistantResponse } from '../integrations/googleGenAI.js';
import { supabase } from '../config/supabaseClient.js';

const router = express.Router();

// Add debugging middleware
router.use((req, res, next) => {
    console.log(`[AI Routes] ${req.method} ${req.path} - Headers:`, req.headers);
    console.log(`[AI Routes] Body:`, req.body);
    next();
});

// Video Analysis endpoint
router.post('/analyze-video', async (req, res) => {
    try {
        console.log('[AI Routes] Video analysis endpoint hit');
        const { videoUrl, mimeType, projectId } = req.body;

        if (!videoUrl || !mimeType) {
            return res.status(400).json({ 
                error: 'Missing required parameters: videoUrl and mimeType' 
            });
        }

        if (!projectId) {
            return res.status(400).json({ 
                error: 'Project ID is required' 
            });
        }

        console.log('Starting video analysis for project:', projectId);
        
        const result = await generateVideoAnalysis(videoUrl, mimeType);
        
        // Save the analysis to the database
        const { error: dbError } = await supabase
            .from('video_analyses')
            .upsert({
                project_id: projectId,
                analysis_data: result,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'project_id'
            });

        if (dbError) {
            console.error('Failed to save video analysis to database:', dbError);
            // Still return the result even if DB save fails
        } else {
            console.log('Video analysis saved to database for project:', projectId);
        }
        
        console.log('Video analysis completed successfully');
        res.json(result);
        
    } catch (error) {
        console.error('Video analysis API error:', error);
        res.status(500).json({ 
            error: error instanceof Error ? error.message : 'Video analysis failed' 
        });
    }
});



// Get existing video analysis
router.get('/video-analysis/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;

        if (!projectId) {
            return res.status(400).json({ 
                error: 'Project ID is required' 
            });
        }

        const { data, error } = await supabase
            .from('video_analyses')
            .select('analysis_data')
            .eq('project_id', projectId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                // No analysis found
                return res.status(404).json({ 
                    error: 'No video analysis found for this project' 
                });
            }
            throw error;
        }

        res.json(data.analysis_data);
        
    } catch (error) {
        console.error('Error fetching video analysis:', error);
        res.status(500).json({ 
            error: error instanceof Error ? error.message : 'Failed to fetch video analysis' 
        });
    }
});

// AI Assistant endpoint
router.post('/assistant', async (req, res) => {
    try {
        console.log('[AI Routes] Assistant endpoint hit');
        const { prompt, semanticJSON, currentTimeline } = req.body;

        if (!prompt) {
            return res.status(400).json({ 
                error: 'Missing required parameter: prompt' 
            });
        }

        console.log('Processing AI assistant request:', prompt);
        
        const result = await generateAIAssistantResponse(prompt, semanticJSON, currentTimeline);
        
        console.log('AI assistant response completed');
        res.json(result);
        
    } catch (error) {
        console.error('AI assistant API error:', error);
        res.status(500).json({ 
            error: error instanceof Error ? error.message : 'AI assistant request failed' 
        });
    }
});

// Analysis Export endpoint - Uses existing export system with optimized settings
router.post('/analyze-video-export', async (req, res) => {
    try {
        console.log('[AI Routes] Analysis export endpoint hit');
        const { clips, tracks, projectId } = req.body;

        if (!clips || !tracks || !projectId) {
            return res.status(400).json({ 
                error: 'Missing required parameters: clips, tracks, projectId' 
            });
        }

        console.log('Starting analysis export for project:', projectId, 'with', clips.length, 'clips and', tracks.length, 'tracks');
        
        // Analysis-optimized export settings (fast but complete)
        const analysisExportSettings = {
            resolution: '480p' as const,     // Lower resolution for speed
            fps: 24,                         // Minimum allowed FPS (24-60 range)
            quality: 'low' as const,         // Lower quality for speed
            quickExport: true,               // Enable all speed optimizations
        };

        // Use the existing export API endpoint
        const exportApiUrl = process.env.NODE_ENV === 'production' 
            ? `${process.env.API_URL || 'https://lemona-app.onrender.com'}/api/v1/export/start`
            : 'http://localhost:3001/api/v1/export/start';

        console.log('Calling export API:', exportApiUrl);

        const exportResponse = await fetch(exportApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': req.headers.authorization || ''
            },
            body: JSON.stringify({
                clips,
                tracks,
                exportSettings: analysisExportSettings
            })
        });

        if (!exportResponse.ok) {
            const errorText = await exportResponse.text();
            console.error('Export API error:', exportResponse.status, errorText);
            throw new Error(`Export failed: ${exportResponse.status} ${errorText}`);
        }

        const { jobId } = await exportResponse.json();
        console.log('Export job started:', jobId);

        // Poll for export completion
        const exportResult = await pollExportCompletion(jobId, req.headers.authorization || '');
        
        if (!exportResult.success) {
            throw new Error(exportResult.error || 'Export failed');
        }

        console.log('Export completed, starting video analysis...');

        // Check if we have a download URL
        if (!exportResult.downloadUrl) {
            throw new Error('Export completed but no download URL provided');
        }

        // Analyze the exported video
        const analysisResult = await generateVideoAnalysis(exportResult.downloadUrl, 'video/mp4');
        
        // Save analysis to database
        const { error: dbError } = await supabase
            .from('video_analyses')
            .upsert({
                project_id: projectId,
                analysis_data: analysisResult,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'project_id'
            });

        if (dbError) {
            console.error('Failed to save video analysis to database:', dbError);
            // Still return the result even if DB save fails
        } else {
            console.log('Video analysis saved to database for project:', projectId);
        }
        
        console.log('Analysis export completed successfully');
        res.json(analysisResult);
        
    } catch (error) {
        console.error('Analysis export API error:', error);
        res.status(500).json({ 
            error: error instanceof Error ? error.message : 'Analysis export failed' 
        });
    }
});

// Helper function to poll export completion
async function pollExportCompletion(jobId: string, authHeader: string = ''): Promise<{ success: boolean; downloadUrl?: string; error?: string }> {
    const maxPolls = 60; // 5 minutes max (5 second intervals)
    let polls = 0;

    const exportStatusUrl = process.env.NODE_ENV === 'production' 
        ? `${process.env.API_URL || 'https://lemona-app.onrender.com'}/api/v1/export/status/${jobId}`
        : `http://localhost:3001/api/v1/export/status/${jobId}`;

    while (polls < maxPolls) {
        try {
            const statusResponse = await fetch(exportStatusUrl, {
                headers: {
                    'Authorization': authHeader || ''
                }
            });

            if (!statusResponse.ok) {
                throw new Error(`Status check failed: ${statusResponse.status}`);
            }

            const { job } = await statusResponse.json();
            
            console.log(`Export job ${jobId} status: ${job.status}, progress: ${job.progress}%`);

            if (job.status === 'completed') {
                return { success: true, downloadUrl: job.downloadUrl };
            }

            if (job.status === 'failed') {
                return { success: false, error: job.error || 'Export failed' };
            }

            // Wait 5 seconds before next poll
            await new Promise(resolve => setTimeout(resolve, 5000));
            polls++;

        } catch (error) {
            console.error('Error polling export status:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Status polling failed' };
        }
    }

    return { success: false, error: 'Export timeout - took longer than 5 minutes' };
}

// Add a test endpoint to verify routing
router.get('/test', (req, res) => {
    console.log('[AI Routes] Test endpoint hit');
    res.json({ message: 'AI routes are working!', timestamp: new Date().toISOString() });
});

// Add a simple assistant test endpoint without authentication
router.post('/assistant-test', (req, res) => {
    console.log('[AI Routes] Assistant test endpoint hit');
    res.json({ 
        message: 'Assistant endpoint is reachable!', 
        receivedBody: req.body,
        timestamp: new Date().toISOString() 
    });
});

// Get chat messages for a project
router.get('/chat-messages/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;
        const authHeader = req.headers.authorization || '';
        const token = authHeader.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({ error: 'No authorization token provided' });
        }

        // Verify token and get user
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        // Get user profile
        const { data: profile, error: profileError } = await supabase
            .from('users')
            .select('id')
            .eq('auth_id', user.id)
            .single();

        if (profileError || !profile) {
            return res.status(404).json({ error: 'User profile not found' });
        }

        // Get chat messages for the project
        const { data: messages, error: messagesError } = await supabase
            .from('chat_messages')
            .select('*')
            .eq('project_id', projectId)
            .eq('user_id', profile.id)
            .order('created_at', { ascending: true });

        if (messagesError) {
            console.error('Failed to fetch chat messages:', messagesError);
            return res.status(500).json({ error: 'Failed to fetch chat messages' });
        }

        // Transform messages to match frontend format
        const transformedMessages = messages.map((msg, index) => ({
            id: index + 1, // Frontend expects numeric IDs
            message: msg.message,
            sender: msg.sender,
            type: msg.message_type,
            commands: msg.metadata?.commands || [],
            searchResults: msg.metadata?.searchResults || [],
            toolActions: msg.metadata?.toolActions || [],
            executionResults: msg.metadata?.executionResults || []
        }));

        res.json(transformedMessages);
    } catch (error) {
        console.error('Error fetching chat messages:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Save a chat message
router.post('/chat-messages', async (req, res) => {
    try {
        const { projectId, message, sender, type = 'text', metadata = {} } = req.body;
        const authHeader = req.headers.authorization || '';
        const token = authHeader.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({ error: 'No authorization token provided' });
        }

        if (!projectId || !message || !sender) {
            return res.status(400).json({ error: 'Missing required fields: projectId, message, sender' });
        }

        if (!['user', 'assistant'].includes(sender)) {
            return res.status(400).json({ error: 'Invalid sender. Must be "user" or "assistant"' });
        }

        // Verify token and get user
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        // Get user profile
        const { data: profile, error: profileError } = await supabase
            .from('users')
            .select('id')
            .eq('auth_id', user.id)
            .single();

        if (profileError || !profile) {
            return res.status(404).json({ error: 'User profile not found' });
        }

        // Save chat message
        const { data: savedMessage, error: saveError } = await supabase
            .from('chat_messages')
            .insert({
                project_id: projectId,
                user_id: profile.id,
                message: message,
                sender: sender,
                message_type: type,
                metadata: metadata
            })
            .select()
            .single();

        if (saveError) {
            console.error('Failed to save chat message:', saveError);
            return res.status(500).json({ error: 'Failed to save chat message' });
        }

        res.json({ 
            success: true, 
            message: 'Chat message saved successfully',
            id: savedMessage.id
        });
    } catch (error) {
        console.error('Error saving chat message:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router; 