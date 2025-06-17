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
            fps: 15,                         // Lower FPS for speed  
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

export default router; 