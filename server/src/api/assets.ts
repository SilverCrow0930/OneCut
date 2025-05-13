import fs from 'fs'
import { Router, Request, Response, NextFunction } from 'express'
import multer from 'multer'
import { v4 as uuid } from 'uuid'
import { Storage } from '@google-cloud/storage'
import { supabase } from '../config/supabaseClient'
import { AuthenticatedRequest } from '../types/types'
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

const bucket = gcs.bucket(process.env.GCS_BUCKET_NAME!)

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

            const duration = req.body.duration ? Number(req.body.duration) : null

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

export default router