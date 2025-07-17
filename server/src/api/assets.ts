import fs from 'fs'
import { Router, Request, Response, NextFunction } from 'express'
import multer from 'multer'
import { v4 as uuid } from 'uuid'
import { supabase } from '../config/supabaseClient.js'
import { AuthenticatedRequest } from '../types/types.js'
import { bucket } from '../integrations/googleStorage.js'
import { Storage } from '@google-cloud/storage'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config()

// Debug: Log environment variable status at startup
console.log('🚀 Assets API startup - Environment check:', {
    hasPexelsKey: !!process.env.PEXELS_API_KEY,
    pexelsKeyLength: process.env.PEXELS_API_KEY?.length || 0,
    hasFreesoundKey: !!process.env.FREESOUND_API_KEY,
    hasGiphyKey: !!process.env.GIPHY_API_KEY,
    nodeEnv: process.env.NODE_ENV
})

const keyFilePath = process.env.GCS_KEY_FILE_PATH
if (!keyFilePath) throw new Error('GCS_KEY_FILE_PATH is not defined in .env')

const resolvedKeyFile = path.isAbsolute(keyFilePath)
    ? keyFilePath
    : path.resolve(process.cwd(), keyFilePath)

console.log('GCS key file path →', resolvedKeyFile)
console.log('  exists on disk? →', fs.existsSync(resolvedKeyFile))

const gcs = new Storage({
    projectId: process.env.GCS_PROJECT_ID,
    keyFilename: resolvedKeyFile,
})

gcs.getBuckets()
    .then(([buckets]) => console.log('✔️ GCS auth OK — buckets:', buckets.map(b => b.name)))
    .catch(e => {
        console.error('❌ GCS auth FAILED:', e)
        process.exit(1)
    })

const router = Router()

const upload = multer({
    storage: multer.memoryStorage()
})

async function getLocalUserId(supaUid: string) {
    const { data: profile, error } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', supaUid)
        .single()

    if (error || !profile) {
        throw new Error('Profile lookup failed')
    }

    return profile.id
}

// GET /api/v1/assets — list all user's assets, sorted by last_used desc
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const supaUid = (req as AuthenticatedRequest).user.id
        const localUserId = await getLocalUserId(supaUid)

        const { data, error } = await supabase
            .from('assets')
            .select('*')
            .eq('user_id', localUserId)
            .order('last_used', { ascending: false, nullsFirst: true })
            .order('created_at', { ascending: false })

        if (error) {
            console.error('Error fetching assets:', error)
            return res.status(500).json({ error: error.message })
        }

        res.json(data)
    }
    catch (err: any) {
        next(err)
    }
})

// POST /api/v1/assets/upload — upload file to GCS and insert record
router.post(
    '/upload',
    upload.single('file'),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const authReq = req as AuthenticatedRequest
            const file = req.file
            if (!file) {
                return res.status(400).json({
                    error: 'No file uploaded'
                })
            }

            // 1) figure out local user_id
            const localUserId = await getLocalUserId(authReq.user.id)

            // 2) Build GCS key & upload
            const ext = (file.originalname.split('.').pop() || '').toLowerCase()
            const uniqueFileName = `${Date.now()}_${uuid()}.${ext}`
            const key = `${authReq.user.id}/${uniqueFileName}`
            const gcsFile = bucket.file(key)

            await gcsFile.save(file.buffer, {
                metadata: { contentType: file.mimetype },
                public: false,
            })

            const duration = req.body.duration ? Number(req.body.duration) * 1000 : null

            // 3) Insert into assets using localUserId
            const { data, error } = await supabase
                .from('assets')
                .insert({
                    user_id: localUserId,
                    name: file.originalname,
                    mime_type: file.mimetype,
                    duration,
                    object_key: key,
                })
                .select('*')
                .single()

            if (error) {
                console.error('Asset insert error:', error)
                return res.status(500).json({ error: error.message })
            }

            res.status(201).json(data)
        }
        catch (err) {
            next(err)
        }
    }
)

// POST /api/v1/assets/upload-to-gcs — upload file to GCS and return GS URI (for QuickClips)
router.post(
    '/upload-to-gcs',
    upload.single('file'),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const authReq = req as AuthenticatedRequest
            const file = req.file
            if (!file) {
                return res.status(400).json({
                    error: 'No file uploaded'
                })
            }

            // Build GCS key & upload
            const ext = (file.originalname.split('.').pop() || '').toLowerCase()
            const uniqueFileName = `${Date.now()}_${uuid()}.${ext}`
            const key = `${authReq.user.id}/${uniqueFileName}`
            const gcsFile = bucket.file(key)

            await gcsFile.save(file.buffer, {
                metadata: { contentType: file.mimetype },
                public: false,
            })

            console.log('File uploaded to GCS:', key)

            // Return the GS URI for processing
            const gsUri = `gs://lemona-edit-assets/${key}`
            
            res.status(200).json({ 
                gsUri,
                objectKey: key,
                filename: file.originalname, // Keep original name for display purposes
                mimeType: file.mimetype
            })
        }
        catch (err) {
            console.error('GCS upload error:', err)
            next(err)
        }
    }
)

// GET /api/v1/assets/:id/url — returns a signed URL valid for 1h
router.get('/:id/url', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authReq = req as AuthenticatedRequest
        const supaUid = authReq.user.id
        const { id } = req.params

        console.log(`[Asset URL] Request for asset ${id} by user ${supaUid}`)

        // 1) map to local user
        const localUserId = await getLocalUserId(supaUid)
        console.log(`[Asset URL] Mapped Supabase user ${supaUid} to local user ${localUserId}`)

        // 2) fetch the object_key for that asset and user
        const { data: asset, error } = await supabase
            .from('assets')
            .select('object_key, mime_type, name')
            .eq('id', id)
            .eq('user_id', localUserId)
            .single()

        if (error) {
            console.error(`[Asset URL] Database error for asset ${id}:`, error)
            return res.status(404).json({
                error: 'Asset not found in database'
            })
        }

        if (!asset) {
            console.error(`[Asset URL] No asset found for id ${id} and user ${localUserId}`)
            return res.status(404).json({
                error: 'Asset not found'
            })
        }

        console.log(`[Asset URL] Found asset ${id}: ${asset.name} (${asset.mime_type}) at ${asset.object_key}`)

        try {
            // 3) Check if file exists in GCS
            const file = bucket.file(asset.object_key)
            const [exists] = await file.exists()
            
            if (!exists) {
                console.error(`[Asset URL] File ${asset.object_key} not found in GCS bucket`)
                return res.status(404).json({
                    error: 'Asset file not found in storage'
                })
            }

            // 4) generate signed URL
            const [url] = await file.getSignedUrl({
                action: 'read',
                expires: Date.now() + 60 * 60 * 1000,
            })

            console.log(`[Asset URL] Generated signed URL for ${id}`)
        res.json({ url })
        } catch (gcsError: any) {
            // Check for billing issues
            if (gcsError?.message?.includes('billing account') || 
                gcsError?.code === 403 || 
                gcsError?.errors?.[0]?.reason === 'accountDisabled') {
                console.error(`[Asset URL] GCP billing account disabled:`, gcsError)
                return res.status(503).json({
                    error: 'Storage service temporarily unavailable',
                    details: 'Storage service is experiencing billing issues. Please contact support.'
                })
            }

            // Other GCS errors
            console.error(`[Asset URL] GCS error for asset ${id}:`, gcsError)
            return res.status(500).json({
                error: 'Storage service error',
                details: 'Failed to access storage service. Please try again later.'
            })
        }
    }
    catch (err) {
        console.error(`[Asset URL] Unexpected error for asset ${req.params.id}:`, err)
        next(err)
    }
})

// DELETE /api/v1/assets/:id — delete asset from GCS and database
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authReq = req as AuthenticatedRequest
        const supaUid = authReq.user.id
        const { id } = req.params

        // 1) map to local user
        const localUserId = await getLocalUserId(supaUid)

        // 2) fetch the object_key for that asset and user
        const { data: asset, error } = await supabase
            .from('assets')
            .select('object_key')
            .eq('id', id)
            .eq('user_id', localUserId)
            .single()

        if (error || !asset) {
            return res.status(404).json({
                error: 'Not found'
            })
        }

        // 3) delete from GCS
        await bucket.file(asset.object_key).delete()

        // 4) delete from database
        const { error: deleteError } = await supabase
            .from('assets')
            .delete()
            .eq('id', id)
            .eq('user_id', localUserId)

        if (deleteError) {
            return res.status(500).json({
                error: 'Failed to delete asset from database'
            })
        }

        res.sendStatus(204)
    }
    catch (err) {
        next(err)
    }
})

// GET /api/v1/assets/pexels — fetch assets from Pexels API
router.get(
    '/pexels',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const type = String(req.query.type || 'image');
            const page = String(req.query.page || '1');
            const per_page = String(req.query.per_page || '20');
            // Use more general default search terms
            const defaultQuery = type === 'video' ? 'nature' : 'people';
            const query = (req.query.query && String(req.query.query).trim()) || defaultQuery;

            // Debug environment variable loading
            console.log('🔍 PEXELS DEBUG INFO:', {
                hasKey: !!process.env.PEXELS_API_KEY,
                keyLength: process.env.PEXELS_API_KEY?.length || 0,
                keyPreview: process.env.PEXELS_API_KEY?.substring(0, 10) + '...' || 'UNDEFINED',
                allEnvKeys: Object.keys(process.env).filter(key => key.includes('PEXELS')),
                nodeEnv: process.env.NODE_ENV
            });

            if (!process.env.PEXELS_API_KEY) {
                console.error('❌ PEXELS_API_KEY environment variable is not set');
                console.error('Available environment variables containing "PEXELS":', Object.keys(process.env).filter(key => key.includes('PEXELS')));
                return res.status(500).json({ error: 'Pexels API key not configured' });
            }

            let url = '';
            if (type === 'video') {
                url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&page=${page}&per_page=${per_page}`;
            } else {
                url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&page=${page}&per_page=${per_page}`;
            }

            console.log('🔍 PEXELS API REQUEST:', {
                type,
                query,
                url: url.replace(process.env.PEXELS_API_KEY, '[REDACTED]'),
                page,
                per_page
            });

            const response = await fetch(url, {
                headers: {
                    'Authorization': process.env.PEXELS_API_KEY
                }
            });

            console.log('📡 PEXELS API RESPONSE:', {
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries())
            });

            if (!response.ok) {
                const text = await response.text();
                console.error('❌ PEXELS API ERROR:', {
                    status: response.status,
                    statusText: response.statusText,
                    body: text
                });
                throw new Error(`Pexels API error: ${response.statusText} - ${text}`);
            }

            const data = await response.json();
            
            // Validate response format
            if (type === 'video' && !Array.isArray(data.videos)) {
                console.error('❌ Invalid video response format:', data);
                throw new Error('Invalid response format from Pexels API - videos array missing');
            }
            if (type === 'image' && !Array.isArray(data.photos)) {
                console.error('❌ Invalid image response format:', data);
                throw new Error('Invalid response format from Pexels API - photos array missing');
            }

            // Log full response for debugging
            console.log('✅ PEXELS API SUCCESS:', {
                type,
                query,
                itemCount: type === 'video' ? data.videos?.length : data.photos?.length,
                totalResults: data.total_results,
                page: data.page,
                per_page: data.per_page,
                responsePreview: JSON.stringify(data).substring(0, 200) + '...'
            });

            // If no results, try a fallback query
            if ((type === 'video' && (!data.videos || data.videos.length === 0)) ||
                (type === 'image' && (!data.photos || data.photos.length === 0))) {
                
                console.log('⚠️ No results found, trying fallback query...');
                
                // Try a more general fallback query
                const fallbackQuery = type === 'video' ? 'city' : 'abstract';
                const fallbackUrl = type === 'video' 
                    ? `https://api.pexels.com/videos/search?query=${encodeURIComponent(fallbackQuery)}&page=${page}&per_page=${per_page}`
                    : `https://api.pexels.com/v1/search?query=${encodeURIComponent(fallbackQuery)}&page=${page}&per_page=${per_page}`;
                
                const fallbackResponse = await fetch(fallbackUrl, {
                    headers: {
                        'Authorization': process.env.PEXELS_API_KEY
                    }
                });
                
                if (fallbackResponse.ok) {
                    const fallbackData = await fallbackResponse.json();
                    console.log('✅ Fallback query succeeded:', {
                        query: fallbackQuery,
                        itemCount: type === 'video' ? fallbackData.videos?.length : fallbackData.photos?.length
                    });
                    return res.json(fallbackData);
                }
            }

            res.json(data);
        }
        catch (err) {
            console.error('❌ PEXELS API HANDLER ERROR:', err);
            next(err);
        }
    }
);

// Debug endpoint to test Pexels API configuration
router.get(
    '/pexels/debug',
    async (req: Request, res: Response) => {
        try {
            console.log('🔧 PEXELS DEBUG ENDPOINT CALLED');
            
            const hasApiKey = !!process.env.PEXELS_API_KEY;
            const keyPreview = process.env.PEXELS_API_KEY ? 
                process.env.PEXELS_API_KEY.substring(0, 10) + '...' : 
                'NOT_SET';

            console.log('🔑 API Key Status:', { hasApiKey, keyPreview });

            if (!hasApiKey) {
                return res.json({
                    status: 'error',
                    message: 'PEXELS_API_KEY environment variable not set',
                    hasApiKey: false
                });
            }

            // Test API call
            const testUrl = 'https://api.pexels.com/v1/search?query=nature&per_page=1';
            console.log('🧪 Testing API call to:', testUrl);

            const response = await fetch(testUrl, {
                headers: {
                    'Authorization': process.env.PEXELS_API_KEY!
                }
            });

            const isSuccess = response.ok;
            const statusCode = response.status;
            const statusText = response.statusText;

            console.log('📊 Test Results:', { isSuccess, statusCode, statusText });

            if (isSuccess) {
                const data = await response.json();
                return res.json({
                    status: 'success',
                    message: 'Pexels API is working correctly',
                    hasApiKey: true,
                    testResult: {
                        statusCode,
                        statusText,
                        photoCount: data.photos?.length || 0,
                        totalResults: data.total_results
                    }
                });
            } else {
                const errorBody = await response.text();
                console.error('❌ Test API call failed:', { statusCode, statusText, errorBody });
                
                return res.json({
                    status: 'error',
                    message: 'Pexels API test failed',
                    hasApiKey: true,
                    testResult: {
                        statusCode,
                        statusText,
                        error: errorBody
                    }
                });
            }

        } catch (error: any) {
            console.error('❌ DEBUG ENDPOINT ERROR:', error);
            return res.json({
                status: 'error',
                message: 'Debug test failed',
                error: error.message,
                hasApiKey: !!process.env.PEXELS_API_KEY
            });
        }
    }
);

// GET /api/v1/assets/freesound — fetch audio assets from Freesound API
router.get(
    '/freesound',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const query = String(req.query.query || 'music');
            const page = String(req.query.page || '1');
            const page_size = String(req.query.page_size || '15');
            const type = String(req.query.type || 'music');

            if (!process.env.FREESOUND_API_KEY) {
                return res.status(500).json({ error: 'Freesound API key not configured' });
            }

            // Build search filter based on type
            let filter = '';
            if (type === 'music') {
                filter = 'tag:music OR tag:loop OR tag:background';
            } else if (type === 'sound') {
                filter = 'tag:sound-effect OR tag:sfx OR tag:foley';
            }

            const url = `https://freesound.org/apiv2/search/text/?query=${encodeURIComponent(query)}&page=${page}&page_size=${page_size}&fields=id,name,description,duration,previews,download,tags,license&filter=${encodeURIComponent(filter)}&token=${process.env.FREESOUND_API_KEY}`;

            console.log('FREESOUND API URL:', url);

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Token ${process.env.FREESOUND_API_KEY}`
                }
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Freesound API error: ${response.statusText} - ${text}`);
            }

            const data = await response.json();
            res.json(data);
        }
        catch (err) {
            console.error('Freesound API error:', err);
            next(err);
        }
    }
);

// GET /api/v1/assets/giphy/stickers — fetch stickers from Giphy API
router.get(
    '/giphy/stickers',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const page = String(req.query.page || '1');
            const limit = String(req.query.limit || '20');
            const query = (req.query.q && String(req.query.q).trim()) || '';

            if (!process.env.GIPHY_API_KEY) {
                return res.status(500).json({ error: 'Giphy API key not configured' });
            }

            let url;
            if (query) {
                url = `https://api.giphy.com/v1/stickers/search?api_key=${process.env.GIPHY_API_KEY}&limit=${limit}&offset=${(parseInt(page) - 1) * parseInt(limit)}&q=${encodeURIComponent(query)}`;
            } else {
                url = `https://api.giphy.com/v1/stickers/trending?api_key=${process.env.GIPHY_API_KEY}&limit=${limit}&offset=${(parseInt(page) - 1) * parseInt(limit)}`;
            }

            console.log('GIPHY API URL:', url);

            const response = await fetch(url);

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Giphy API error: ${response.statusText} - ${text}`);
            }

            const data = await response.json();
            res.json(data);
        }
        catch (err) {
            next(err);
        }
    }
);

export default router