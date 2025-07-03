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
import ffmpeg from 'fluent-ffmpeg'
import os from 'os'

dotenv.config()

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
            const key = `${authReq.user.id}/${uuid()}.${ext}`
            const gcsFile = bucket.file(key)

            await gcsFile.save(file.buffer, {
                metadata: { contentType: file.mimetype },
                public: false,
            })

            const duration = req.body.duration ? Number(req.body.duration) * 1000 : null

            // 3) Generate thumbnail for video assets
            let thumbnailKey = null
            if (file.mimetype.startsWith('video/')) {
                try {
                    // Create temp files
                    const tempDir = os.tmpdir()
                    const tempVideoPath = path.join(tempDir, `temp_${uuid()}.${ext}`)
                    const tempThumbPath = path.join(tempDir, `thumb_${uuid()}.jpg`)

                    // Write uploaded file to temp
                    await fs.promises.writeFile(tempVideoPath, file.buffer)

                    // Generate thumbnail using ffmpeg
                    await new Promise<void>((resolve, reject) => {
                        ffmpeg(tempVideoPath)
                            .screenshots({
                                timestamps: ['1'],
                                filename: path.basename(tempThumbPath),
                                folder: path.dirname(tempThumbPath),
                                size: '640x360'
                            })
                            .on('end', () => resolve())
                            .on('error', (err) => reject(err))
                    })

                    // Upload thumbnail to GCS
                    thumbnailKey = `${authReq.user.id}/${uuid()}_thumb.jpg`
                    const thumbBuffer = await fs.promises.readFile(tempThumbPath)
                    await bucket.file(thumbnailKey).save(thumbBuffer, {
                        metadata: { contentType: 'image/jpeg' },
                        public: false,
                    })

                    // Cleanup temp files
                    await Promise.all([
                        fs.promises.unlink(tempVideoPath),
                        fs.promises.unlink(tempThumbPath)
                    ]).catch(console.error)
                } catch (thumbError) {
                    console.error('Failed to generate thumbnail:', thumbError)
                    // Continue without thumbnail
                }
            }

            // 4) Insert into assets using localUserId
            const { data, error } = await supabase
                .from('assets')
                .insert({
                    user_id: localUserId,
                    name: file.originalname,
                    mime_type: file.mimetype,
                    duration,
                    object_key: key,
                    thumbnail_key: thumbnailKey
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
            const key = `${authReq.user.id}/${uuid()}.${ext}`
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
                filename: file.originalname,
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

// GET /api/v1/assets/:id/thumbnail — returns a signed URL for the thumbnail
router.get('/:id/thumbnail', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authReq = req as AuthenticatedRequest
        const supaUid = authReq.user.id
        const { id } = req.params

        // 1) map to local user
        const localUserId = await getLocalUserId(supaUid)

        // 2) fetch the thumbnail_key for that asset and user
        const { data: asset, error } = await supabase
            .from('assets')
            .select('thumbnail_key, mime_type')
            .eq('id', id)
            .eq('user_id', localUserId)
            .single()

        if (error || !asset) {
            return res.status(404).json({
                error: 'Asset not found'
            })
        }

        if (!asset.thumbnail_key) {
            return res.status(404).json({
                error: 'No thumbnail available'
            })
        }

        try {
            // 3) Check if file exists in GCS
            const file = bucket.file(asset.thumbnail_key)
            const [exists] = await file.exists()
            
            if (!exists) {
                return res.status(404).json({
                    error: 'Thumbnail file not found in storage'
                })
            }

            // 4) generate signed URL
            const [url] = await file.getSignedUrl({
                action: 'read',
                expires: Date.now() + 60 * 60 * 1000,
            })

            res.json({ url })
        } catch (gcsError: any) {
            // Check for billing issues
            if (gcsError?.message?.includes('billing account') || 
                gcsError?.code === 403 || 
                gcsError?.errors?.[0]?.reason === 'accountDisabled') {
                return res.status(503).json({
                    error: 'Storage service temporarily unavailable',
                    details: 'Storage service is experiencing billing issues. Please contact support.'
                })
            }

            // Other GCS errors
            console.error(`[Thumbnail URL] GCS error for asset ${id}:`, gcsError)
            return res.status(500).json({
                error: 'Storage service error',
                details: 'Failed to access storage service. Please try again later.'
            })
        }
    }
    catch (err) {
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
            const query = (req.query.query && String(req.query.query).trim()) || 'vertical';

            if (!process.env.PEXELS_API_KEY) {
                return res.status(500).json({ error: 'Pexels API key not configured' });
            }

            const orientation = 'portrait';
            let url = '';
            if (type === 'video') {
                url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&orientation=${orientation}&page=${page}&per_page=${per_page}`;
            } else {
                url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&orientation=${orientation}&page=${page}&per_page=${per_page}`;
            }

            console.log('PEXELS API URL:', url);

            const response = await fetch(url, {
                headers: {
                    'Authorization': process.env.PEXELS_API_KEY
                }
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Pexels API error: ${response.statusText} - ${text}`);
            }

            const data = await response.json();
            res.json(data);
        }
        catch (err) {
            next(err);
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