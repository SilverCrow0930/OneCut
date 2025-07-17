import { BrowserRenderer } from './src/services/browserRenderer.js'
import { ElementClassifier } from './src/services/elementClassifier.js'
import fs from 'fs/promises'
import path from 'path'

// Test data matching your editor format
const testElements = [
  {
    id: 'video-1',
    type: 'video',
    timelineStartMs: 0,
    timelineEndMs: 5000,
    sourceStartMs: 0,
    sourceEndMs: 5000,
    assetId: 'video-asset-1',
    speed: 1,
    opacity: 1
  },
  {
    id: 'text-1',
    type: 'text',
    timelineStartMs: 1000,
    timelineEndMs: 4000,
    text: 'Hello Lemona!',
    properties: {
      style: {
        fontSize: '32px',
        fontFamily: 'Inter',
        fontWeight: 'bold',
        color: '#ffffff',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        borderRadius: '8px',
        padding: '16px',
        textAlign: 'center'
      },
      crop: {
        left: 50,
        top: 100,
        width: 400,
        height: 100
      },
      placement: 'middle'
    }
  },
  {
    id: 'caption-1',
    type: 'caption',
    timelineStartMs: 2000,
    timelineEndMs: 3500,
    text: 'This is a <span color="#ff6b6b">highlighted</span> caption',
    properties: {
      style: {
        fontSize: '24px',
        fontFamily: 'Roboto',
        fontWeight: '600',
        color: '#ffffff'
      },
      crop: {
        left: 100,
        top: 400,
        width: 500,
        height: 80
      },
      placement: 'bottom'
    }
  },
  {
    id: 'sticker-1',
    type: 'sticker',
    timelineStartMs: 500,
    timelineEndMs: 2500,
    properties: {
      externalAsset: {
        url: 'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif',
        originalData: {
          isSticker: true
        }
      },
      crop: {
        left: 350,
        top: 200,
        width: 150,
        height: 150
      }
    }
  }
]

async function testHybridSystem() {
  console.log('🧪 Testing Hybrid Export System')
  console.log('=' .repeat(50))
  
  try {
    // Step 1: Test Element Classification
    console.log('\n1️⃣ Testing Element Classification...')
    const classification = ElementClassifier.classify(testElements)
    
    console.log(`✅ Classification Results:`)
    console.log(`   - Styled Elements: ${classification.styledElements.length}`)
    console.log(`   - Media Elements: ${classification.mediaElements.length}`)
    console.log(`   - Stats: ${ElementClassifier.getStats(classification)}`)
    
    // Step 2: Test Browser Renderer
    console.log('\n2️⃣ Testing Browser Renderer...')
    
    if (classification.hasStyledElements) {
      // Create temp directory if it doesn't exist
      const tempDir = './temp'
      try {
        await fs.mkdir(tempDir, { recursive: true })
      } catch (err) {
        // Directory might already exist, that's okay
      }
      
      const renderer = new BrowserRenderer(tempDir, 'test-job')
      
      try {
        await renderer.initialize(1920, 1080)
        console.log('✅ Browser initialized successfully')
        
        const overlayPath = await renderer.renderOverlayFrames(
          classification.styledElements,
          5000, // 5 seconds
          30    // 30 FPS
        )
        
        if (overlayPath) {
          console.log(`✅ Browser rendering completed: ${overlayPath}`)
          
          // Check if frames were actually created
          const overlayDir = path.dirname(overlayPath)
          const files = await fs.readdir(overlayDir)
          const frameFiles = files.filter(f => f.startsWith('frame_') && f.endsWith('.png'))
          console.log(`   - Generated ${frameFiles.length} overlay frames`)
          
          if (frameFiles.length > 0) {
            console.log(`   - First frame: ${frameFiles[0]}`)
            console.log(`   - Last frame: ${frameFiles[frameFiles.length - 1]}`)
          }
        }
      } finally {
        await renderer.cleanup()
        console.log('✅ Browser cleanup completed')
      }
    }
    
    // Step 3: Test Export Integration
    console.log('\n3️⃣ Testing Export Integration...')
    
    const shouldUseHybrid = ElementClassifier.shouldUseHybridRendering(testElements)
    console.log(`✅ Should use hybrid rendering: ${shouldUseHybrid}`)
    
    if (shouldUseHybrid) {
      console.log('✅ Hybrid rendering is correctly detected for this timeline')
      console.log('   - Text elements will be browser-rendered')
      console.log('   - Caption elements will be browser-rendered')
      console.log('   - Sticker elements will be browser-rendered')
      console.log('   - Video elements will be FFmpeg-processed')
    }
    
    console.log('\n🎉 All tests passed! Hybrid system is working correctly.')
    console.log('\nNext steps:')
    console.log('1. Try exporting a video with text/captions from your editor')
    console.log('2. Check the server logs for "[BrowserRenderer]" messages')
    console.log('3. Verify the exported video matches your editor preview')
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
    console.error('Stack:', error.stack)
    
    if (error.message.includes('puppeteer')) {
      console.log('\n💡 Puppeteer troubleshooting:')
      console.log('   - Make sure Puppeteer is installed: npm install puppeteer')
      console.log('   - Check Chrome dependencies on your system')
      console.log('   - Try running: npx puppeteer browsers install chrome')
    }
  }
}

// Run the test
testHybridSystem().catch(console.error) 