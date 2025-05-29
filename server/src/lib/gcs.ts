import { Storage } from '@google-cloud/storage'
import { v4 as uuid } from 'uuid'

const storage = new Storage()
export const bucket = storage.bucket(process.env.GCS_BUCKET_NAME!)

export async function uploadToGCS(blob: Blob, path: string): Promise<string> {
    const buffer = Buffer.from(await blob.arrayBuffer())
    const file = bucket.file(path)

    await file.save(buffer, {
        metadata: {
            contentType: blob.type,
            public: true
        }
    })

    const [url] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
    })

    return url
} 