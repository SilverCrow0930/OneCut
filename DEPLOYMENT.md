# Deployment Guide

## Environment Variables

### Client (Frontend) - Vercel/Netlify
Set these environment variables in your deployment platform:

```
NEXT_PUBLIC_API_URL=https://lemona-app.onrender.com
```

### Server (Backend) - Render
Set these environment variables in your Render dashboard:

```
NODE_ENV=production
ALLOWED_ORIGINS=https://lemona.studio,https://www.lemona.studio
FAL_API_KEY=your_fal_api_key_here
DATABASE_URL=your_database_url_here
GOOGLE_APPLICATION_CREDENTIALS_JSON=your_google_credentials_json_here
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
```

## CORS Configuration

The server is configured to allow the following origins in production:
- `https://lemona.studio`
- `https://www.lemona.studio` 
- `https://lemona-app.onrender.com`

## WebSocket Configuration

WebSocket connections are supported with both `websocket` and `polling` transports for maximum compatibility with various hosting providers and network configurations.

## Troubleshooting

### CORS Errors
If you see CORS errors like "No 'Access-Control-Allow-Origin' header is present":

1. Verify that `NODE_ENV=production` is set on the server
2. Check that your frontend domain is included in the `productionOrigins` array in `server/src/index.ts`
3. Ensure `NEXT_PUBLIC_API_URL` is set correctly on the client

### WebSocket Connection Issues
If WebSocket connections fail:

1. Check server logs for CORS-related errors
2. Verify that both websocket and polling transports are enabled
3. Ensure the frontend is using the correct API URL

### Environment Variable Issues
- Client environment variables must be prefixed with `NEXT_PUBLIC_`
- Server environment variables should not have this prefix
- Restart deployments after changing environment variables 