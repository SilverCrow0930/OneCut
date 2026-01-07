# OneCut

OneCut is an AI-powered web-based video editor that transforms long-form content into engaging highlights. Built for professionals, educators, and content creators who need to quickly turn hours of footage into shareable videos without the complexity of traditional editing software.

## Overview

OneCut combines advanced AI analysis with an intuitive editing interface to automate the most time-consuming parts of video production. Upload your long recordings, let AI identify the best moments, and refine the results with professional editing tools—all in your browser.

## Key Features

### AI-Powered Smart Cut
- Automatically analyzes video content to identify engaging moments
- Supports multiple content types: podcasts, interviews, tutorials, gaming, and more
- Generates highlights optimized for short-form (20s-2min) or long-form (2-30min) content
- Customizable AI instructions for targeted editing

### Professional Video Editor
- Multi-track timeline with drag-and-drop editing
- Precise clip trimming and splitting
- Speed adjustment (0.5x to 3x playback speed)
- Aspect ratio support (16:9, 9:16, 1:1)

### Captions & Text
- Automatic caption generation with multilingual support
- Multiple caption styles: default, short-form, professional, minimal
- Customizable text overlays with fonts, colors, and positioning
- Millisecond-precise timing synchronization

### Audio Tools
- AI voiceover generation with multiple voice options
- Background music library with genre and mood filters
- Volume adjustment and audio enhancement
- Noise reduction capabilities

### Visual Effects
- Professional transitions: fade, slide, zoom, wipe, dissolve
- Animated stickers and GIFs
- Text animations and styling
- Visual filters and effects

### Export & Sharing
- High-quality video export in multiple resolutions
- Platform-optimized formats for YouTube, TikTok, Instagram
- Hybrid rendering system combining FFmpeg and browser-based rendering
- Fast export processing with progress tracking

## How It Works

1. **Upload**: Drag and drop your video file (supports MP4, MOV, AVI, and more)
2. **AI Analysis**: Our AI analyzes your content, identifies key moments, and generates highlights
3. **Edit**: Refine your video with the professional editor—add captions, text, transitions, and more
4. **Export**: Download your finished video optimized for your target platform

## Technology Stack

### Frontend
- **Framework**: Next.js 15 with React 18
- **Styling**: Tailwind CSS 4
- **State Management**: React Context API
- **Video Processing**: FFmpeg.wasm for client-side operations
- **Real-time**: Socket.io for live updates

### Backend
- **Runtime**: Node.js with Express
- **Language**: TypeScript
- **AI Integration**: Google Vertex AI, Google GenAI
- **Video Processing**: FFmpeg, Puppeteer for hybrid rendering
- **Storage**: Google Cloud Storage
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth

### Infrastructure
- **Deployment**: Render.com
- **File Storage**: Google Cloud Storage
- **Video Transcoding**: Google Cloud Video Transcoder API
- **Voice Synthesis**: ElevenLabs API

## Project Structure

```
OneCut/
├── client/                 # Next.js frontend application
│   ├── src/
│   │   ├── app/           # Next.js app router pages
│   │   ├── components/    # React components
│   │   │   ├── editor/   # Video editor components
│   │   │   ├── home/     # Landing page components
│   │   │   └── ui/       # Reusable UI components
│   │   ├── contexts/     # React context providers
│   │   ├── hooks/        # Custom React hooks
│   │   ├── lib/          # Utility functions and config
│   │   ├── services/     # API and business logic
│   │   └── types/        # TypeScript type definitions
│   └── public/           # Static assets
│
├── server/                # Express backend API
│   ├── src/
│   │   ├── api/         # API route handlers
│   │   ├── integrations/ # Third-party service integrations
│   │   ├── services/    # Business logic services
│   │   ├── middleware/  # Express middleware
│   │   └── types/       # TypeScript type definitions
│   └── test-hybrid-export.js
│
└── _db/                  # Database schema and migrations
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase account and project
- Google Cloud Platform account with:
  - Cloud Storage bucket
  - Vertex AI API enabled
  - Video Transcoder API enabled
- ElevenLabs API key (for voiceover features)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd OneCut
```

2. Install root dependencies:
```bash
npm install
```

3. Install client dependencies:
```bash
cd client
npm install
```

4. Install server dependencies:
```bash
cd ../server
npm install
```

### Environment Setup

Create environment files for both client and server:

**client/.env.local:**
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_API_URL=http://localhost:3001
```

**server/.env:**
```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_key
GOOGLE_CLOUD_STORAGE_BUCKET=your_bucket_name
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json
VERTEX_AI_PROJECT_ID=your_project_id
VERTEX_AI_LOCATION=us-central1
ELEVENLABS_API_KEY=your_elevenlabs_key
PORT=3001
```

### Database Setup

Run the database migrations in the `_db/` directory to set up your schema:

```bash
# Connect to your Supabase database and run migrations
psql -h your-db-host -U postgres -d postgres -f _db/users.sql
psql -h your-db-host -U postgres -d postgres -f _db/projects.sql
# ... (run other migration files as needed)
```

### Running the Application

1. Start the backend server:
```bash
cd server
npm run dev
```

2. Start the frontend development server:
```bash
cd client
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

## Architecture Highlights

### Hybrid Export System

OneCut uses a hybrid rendering approach that combines FFmpeg for media processing with Puppeteer for HTML/CSS rendering. This ensures:

- Perfect fidelity between editor preview and final export
- Efficient processing of complex visual elements
- Support for advanced text styling and animations
- Scalable export processing

### AI Processing Pipeline

1. **Video Analysis**: Semantic analysis creates a structured JSON representation of video content
2. **Scene Detection**: Identifies key moments, transitions, and highlights
3. **Transcription**: Multilingual speech-to-text with precise timing
4. **Smart Cutting**: AI-powered clip generation based on content type and user preferences

### Real-time Updates

WebSocket connections provide live progress updates for:
- Video processing jobs
- Export rendering
- AI analysis progress

## API Documentation

### Authentication

All API endpoints require authentication via Supabase JWT tokens in the Authorization header:
```
Authorization: Bearer <access_token>
```

### Key Endpoints

- `POST /api/projects` - Create a new project
- `POST /api/assets/upload-to-gcs` - Upload video file
- `POST /api/quickclips/start` - Start AI highlight generation
- `GET /api/timeline/:projectId` - Get project timeline
- `POST /api/export/start` - Start video export
- `GET /api/export/status/:jobId` - Check export status

## Development

### Code Style

- TypeScript for type safety
- ESLint for code quality
- Prettier for code formatting

### Testing

Run tests with:
```bash
npm test
```

### Building for Production

Build the client:
```bash
cd client
npm run build
```

Build the server:
```bash
cd server
npm run build
```

## Contributing

We welcome contributions! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

[Specify your license here]

## Support

For support, email [your-email] or open an issue in the repository.

## Roadmap

- [ ] Enhanced AI editing suggestions
- [ ] Collaborative editing features
- [ ] Mobile app support
- [ ] Advanced color grading
- [ ] Plugin system for custom effects

---

Built with modern web technologies to make professional video editing accessible to everyone.
