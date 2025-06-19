# Freesound API Setup Guide

## Overview
The audio section in AssetsToolPanel now supports music and sound effects from Freesound.org, a collaborative database of Creative Commons licensed sounds.

## Features Added
- **Music Tab**: Browse music loops, background music, and ambient sounds
- **Sound FX Tab**: Browse sound effects, foley sounds, and audio clips
- **Audio Preview**: Click play button to preview audio before adding to timeline
- **Drag & Drop**: Drag audio assets directly to timeline
- **Click to Add**: Click audio assets to automatically add them to an audio track

## API Setup

### 1. Get Freesound API Key
1. Go to [Freesound.org](https://freesound.org)
2. Create a free account
3. Go to [API Keys page](https://freesound.org/apiv2/apply/)
4. Apply for an API key (usually approved instantly)
5. Copy your API token

### 2. Add Environment Variable
Add the following to your server environment variables:

```bash
FREESOUND_API_KEY=your_freesound_api_token_here
```

### 3. API Endpoint
The new endpoint is available at:
```
GET /api/v1/assets/freesound
```

**Query Parameters:**
- `query` - Search term (default: "music")
- `page` - Page number (default: 1)
- `page_size` - Results per page (default: 15)
- `type` - Asset type: "music" or "sound" (default: "music")

**Example:**
```
GET /api/v1/assets/freesound?query=piano&type=music&page=1
```

## Audio Asset Types

### FreesoundAudio Interface
```typescript
interface FreesoundAudio {
    id: number;
    name: string;
    description: string;
    duration: number; // in seconds
    previews: {
        'preview-hq-mp3': string;
        'preview-lq-mp3': string;
        'preview-hq-ogg': string;
        'preview-lq-ogg': string;
    };
    download: string;
    tags: string[];
    license: string;
    username?: string;
}
```

## Usage
1. Click the "Music" or "Sound FX" tabs in the Assets panel
2. Search for audio using the search bar
3. Preview audio by clicking the play button
4. Add to timeline by clicking the asset or dragging to a track
5. Audio assets are automatically placed on audio tracks

## Licensing
All Freesound assets are Creative Commons licensed. The license information is included in each asset's metadata. Make sure to comply with the specific license terms for each audio file you use.

## Troubleshooting
- If audio assets don't load, check that `FREESOUND_API_KEY` is set correctly
- Audio previews use the preview URLs from Freesound (lower quality)
- Full quality audio would require implementing the download flow (requires additional API calls) 