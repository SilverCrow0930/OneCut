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

**Transport Priority**: The system now prioritizes `polling` transport first, then upgrades to `websocket` when stable. This provides better reliability on platforms like Render that may have WebSocket connection limitations.

## Troubleshooting

### CORS Errors
If you see CORS errors like "No 'Access-Control-Allow-Origin' header is present":

1. Verify that `NODE_ENV=production` is set on the server
2. Check that your frontend domain is included in the `productionOrigins` array in `server/src/index.ts`
3. Ensure `NEXT_PUBLIC_API_URL` is set correctly on the client

### WebSocket Connection Issues
If WebSocket connections fail:

1. **Check the browser console** for detailed connection logs with emojis (✅, ❌, 🔌, 🔄)
2. Verify that both websocket and polling transports are enabled
3. Ensure the frontend is using the correct API URL
4. **Transport Priority**: The system will try polling first, then upgrade to websocket
5. **Render-specific**: Render may block direct WebSocket connections, so polling fallback is essential

### Environment Variable Issues
- Client environment variables must be prefixed with `NEXT_PUBLIC_`
- Server environment variables should not have this prefix
- Restart deployments after changing environment variables

### Connection Debugging
Monitor the browser console for these connection indicators:
- ✅ `WebSocket connected successfully` - Connection established
- 🔌 `WebSocket disconnected` - Connection lost
- 🔄 `Reconnection attempt` - Attempting to reconnect
- ❌ `WebSocket connection error` - Connection failed
- `Transport used: polling/websocket` - Shows which transport is active 