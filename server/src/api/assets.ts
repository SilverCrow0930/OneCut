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

        // 3) generate signed URL
        const [url] = await bucket
            .file(asset.object_key)
            .getSignedUrl({
                action: 'read',
                expires: Date.now() + 60 * 60 * 1000,
            })

        res.json({ url })
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

        console.log('DELETE asset request:', { assetId: id, userId: supaUid })

        // Validate asset ID format
        if (!id || typeof id !== 'string') {
            return res.status(400).json({
                error: 'Invalid asset ID'
            })
        }

        // 1) map to local user
        let localUserId: string
        try {
            localUserId = await getLocalUserId(supaUid)
        } catch (error) {
            console.error('Failed to get local user ID:', error)
            return res.status(500).json({
                error: 'Failed to authenticate user'
            })
        }

        // 2) fetch the object_key for that asset and user
        const { data: asset, error } = await supabase
            .from('assets')
            .select('object_key')
            .eq('id', id)
            .eq('user_id', localUserId)
            .single()

        if (error) {
            console.error('Asset lookup error:', error)
            return res.status(404).json({
                error: 'Asset not found'
            })
        }

        if (!asset) {
            return res.status(404).json({
                error: 'Asset not found'
            })
        }

        console.log('Found asset to delete:', { objectKey: asset.object_key })

        // 3) delete from GCS (with error handling)
        try {
            await bucket.file(asset.object_key).delete()
            console.log('Successfully deleted from GCS:', asset.object_key)
        } catch (gcsError: any) {
            console.error('GCS deletion error:', gcsError)
            // Continue with database deletion even if GCS fails
            // The file might already be deleted or not exist
        }

        // 4) delete from database
        const { error: deleteError } = await supabase
            .from('assets')
            .delete()
            .eq('id', id)
            .eq('user_id', localUserId)

        if (deleteError) {
            console.error('Database deletion error:', deleteError)
            return res.status(500).json({
                error: 'Failed to delete asset from database'
            })
        }

        console.log('Successfully deleted asset:', id)
        res.sendStatus(204)
    }
    catch (err: any) {
        console.error('Asset deletion error:', err)
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