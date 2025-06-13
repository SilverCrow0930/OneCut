const { Storage } = require('@google-cloud/storage');
const path = require('path');
require('dotenv').config();

async function setupCORS() {
    try {
        const keyFilePath = process.env.GCS_KEY_FILE_PATH;
        if (!keyFilePath) {
            throw new Error('GCS_KEY_FILE_PATH is not defined in .env');
        }

        const resolvedKeyFile = path.isAbsolute(keyFilePath)
            ? keyFilePath
            : path.resolve(process.cwd(), keyFilePath);

        const storage = new Storage({
            projectId: process.env.GCS_PROJECT_ID,
            keyFilename: resolvedKeyFile,
        });

        const bucketName = process.env.GCS_BUCKET_NAME;
        const bucket = storage.bucket(bucketName);

        // CORS configuration
        const corsConfiguration = [
            {
                origin: ['*'], // Allow all origins - you can restrict this to your domain
                method: ['GET', 'HEAD', 'OPTIONS'],
                responseHeader: [
                    'Content-Type',
                    'Access-Control-Allow-Origin',
                    'Access-Control-Allow-Methods',
                    'Access-Control-Allow-Headers',
                    'Cache-Control',
                    'Content-Length',
                    'Date',
                    'ETag',
                    'Server'
                ],
                maxAgeSeconds: 3600
            }
        ];

        console.log('Setting CORS configuration for bucket:', bucketName);
        await bucket.setCorsConfiguration(corsConfiguration);
        console.log('✅ CORS configuration set successfully!');

        // Verify the configuration
        const [metadata] = await bucket.getMetadata();
        console.log('Current CORS configuration:', JSON.stringify(metadata.cors, null, 2));

    } catch (error) {
        console.error('❌ Error setting CORS configuration:', error);
        process.exit(1);
    }
}

setupCORS(); 