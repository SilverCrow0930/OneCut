import { Storage, Bucket, GetBucketsResponse } from '@google-cloud/storage'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'

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
    .then((response: GetBucketsResponse) => {
        const [buckets] = response
        console.log('✔️ GCS auth OK — buckets:', buckets.map(b => b.name))
    })
    .catch((e: Error) => {
        console.error('❌ GCS auth FAILED:', e)
        process.exit(1)
    })

export const bucket = gcs.bucket(process.env.GCS_BUCKET_NAME!) 