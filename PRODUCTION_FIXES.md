# Production Deployment Fixes

## Issues Fixed

### 1. CORS Policy Error
**Problem**: `Access-Control-Allow-Origin` header blocked requests from `lemona.studio` because server only allowed `localhost:3000`

**Root Cause**: WebSocket server CORS configuration was hardcoded to development origins

**Solution**: Updated WebSocket CORS configuration to dynamically allow production domains:
```typescript
// server/src/websocket/index.ts
cors: {
    origin: process.env.NODE_ENV === 'production' 
        ? ['https://lemona.studio', 'https://www.lemona.studio', 'https://lemona-app.onrender.com']
        : (process.env.CLIENT_URL || 'http://localhost:3000'),
    methods: ['GET', 'POST'],
    credentials: true
}
```

### 2. AI Assistant 405 Error
**Problem**: Enhanced assistant returning "AI request failed (405)" error

**Root Causes**:
1. API endpoint mismatch - client calling `/api/ai/assistant` but server expecting `/api/v1/ai/assistant`
2. Missing authentication tokens in WebSocket connections
3. Missing environment variables for Gemini AI integration

**Solutions**:

#### A. Fixed API Route Configuration
```typescript
// server/src/index.ts
// Added dedicated AI routes without v1 prefix
app.use('/api/ai', authenticate, aiRouter)
```

#### B. Fixed WebSocket Authentication
Updated all WebSocket connections to include proper authentication:

```typescript
// Enhanced Assistant
const socket = io(API_URL, {
    transports: ['websocket'],
    path: '/socket.io/',
    auth: {
        userId: session.user.id,
        token: session.access_token,
        projectId: project.id
    }
})

// Old Assistant
auth: {
    userId: session.user.id,
    token: session.access_token
}

// AutocutContext
auth: {
    userId: user.id,
    token: session.access_token
}
```

#### C. Added Missing Environment Variables
```yaml
# render.yaml
- key: CLIENT_URL
  value: https://lemona.studio
- key: GEMINI_API_KEY
  sync: false
- key: GOOGLE_CLOUD_PROJECT
  sync: false
- key: GOOGLE_CLOUD_LOCATION
  sync: false
```

## Files Modified

### Server-side Changes
1. `server/src/websocket/index.ts` - Fixed CORS configuration
2. `server/src/index.ts` - Added AI routes without v1 prefix
3. `render.yaml` - Added missing environment variables

### Client-side Changes
1. `client/src/components/editor/panels/EnhancedAssistant.tsx` - Added WebSocket authentication
2. `client/src/components/editor/panels/Assistant.tsx` - Added WebSocket authentication
3. `client/src/contexts/AutocutContext.tsx` - Added WebSocket authentication

## Deployment Steps

1. **Update Environment Variables**: Ensure all required environment variables are set in Render dashboard:
   - `GEMINI_API_KEY`
   - `GOOGLE_CLOUD_PROJECT`
   - `GOOGLE_CLOUD_LOCATION`
   - `CLIENT_URL`

2. **Deploy Backend**: The server changes will automatically deploy via Render

3. **Deploy Frontend**: The client changes will automatically deploy via Render

4. **Verify Functionality**:
   - WebSocket connections should work without CORS errors
   - AI assistant should respond without 405 errors
   - Enhanced features (@ mentions, Agent/Ask modes, AI edits) should be functional

## Expected Results

After deployment:
- ✅ WebSocket connections from `lemona.studio` will be allowed
- ✅ AI assistant will connect to Gemini API successfully
- ✅ Enhanced assistant features will work in production
- ✅ All authentication will work properly
- ✅ No more CORS or 405 errors

## Testing Checklist

- [ ] Open `https://lemona.studio` in browser
- [ ] Check browser console for CORS errors (should be none)
- [ ] Test AI assistant chat functionality
- [ ] Test @ mentions feature
- [ ] Test Agent/Ask mode switching
- [ ] Test file upload functionality
- [ ] Verify AI edits panel works
- [ ] Check WebSocket connection status

## Rollback Plan

If issues occur, the previous working state can be restored by:
1. Reverting the WebSocket CORS changes
2. Removing the new AI routes
3. Reverting client authentication changes

However, this would restore the original CORS and 405 errors. 