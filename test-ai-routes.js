const https = require('https');

const BASE_URL = 'lemona-app.onrender.com';

function makeRequest(path, method = 'GET', body = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: BASE_URL,
            port: 443,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };

        console.log(`\n🔍 Testing: ${method} ${path}`);
        console.log(`📡 URL: https://${BASE_URL}${path}`);

        const req = https.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                console.log(`📊 Status: ${res.statusCode} ${res.statusMessage}`);
                console.log(`📋 Headers:`, Object.keys(res.headers));
                
                if (data) {
                    try {
                        const parsed = JSON.parse(data);
                        console.log(`✅ Response:`, parsed);
                    } catch (e) {
                        console.log(`📄 Raw Response:`, data.substring(0, 200));
                    }
                } else {
                    console.log(`⚠️ Empty response body`);
                }

                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    body: data
                });
            });
        });

        req.on('error', (e) => {
            console.error(`❌ Request error:`, e.message);
            reject(e);
        });

        if (body) {
            req.write(JSON.stringify(body));
        }
        
        req.end();
    });
}

async function runTests() {
    console.log('🚀 Starting AI Routes Test Suite');
    console.log('=' .repeat(50));

    const tests = [
        // Basic health check
        {
            name: 'Health Check',
            path: '/health',
            method: 'GET'
        },
        
        // Emergency test route
        {
            name: 'Emergency Test Route',
            path: '/api/ai/emergency-test',
            method: 'GET'
        },
        
        // Routes debug endpoint
        {
            name: 'Routes Debug',
            path: '/api/ai/routes-debug',
            method: 'GET'
        },
        
        // GET assistant (emergency test)
        {
            name: 'Assistant GET (Emergency)',
            path: '/api/ai/assistant',
            method: 'GET'
        },
        
        // AI test endpoint
        {
            name: 'AI Test Endpoint',
            path: '/api/ai/test',
            method: 'GET'
        },
        
        // POST test endpoint
        {
            name: 'AI POST Test',
            path: '/api/ai/test-post',
            method: 'POST',
            body: { test: 'data' }
        },
        
        // Debug routes listing
        {
            name: 'Debug Routes',
            path: '/debug/routes',
            method: 'GET'
        },
        
        // The problematic assistant POST (without auth)
        {
            name: 'Assistant POST (No Auth)',
            path: '/api/ai/assistant',
            method: 'POST',
            body: { prompt: 'test prompt' }
        }
    ];

    for (const test of tests) {
        try {
            console.log(`\n🧪 Test: ${test.name}`);
            console.log('-'.repeat(30));
            
            const result = await makeRequest(test.path, test.method, test.body);
            
            if (result.status === 200) {
                console.log(`✅ PASS: ${test.name}`);
            } else if (result.status === 401) {
                console.log(`🔐 AUTH REQUIRED: ${test.name} (Expected for protected routes)`);
            } else if (result.status === 405) {
                console.log(`❌ FAIL: ${test.name} - Method Not Allowed`);
            } else {
                console.log(`⚠️ UNEXPECTED: ${test.name} - Status ${result.status}`);
            }
            
        } catch (error) {
            console.log(`💥 ERROR: ${test.name} - ${error.message}`);
        }
        
        // Wait a bit between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n' + '='.repeat(50));
    console.log('🏁 Test Suite Complete');
    console.log('\n📝 Analysis:');
    console.log('- If emergency-test works: Router is mounted correctly');
    console.log('- If routes-debug works: Route registration is working');
    console.log('- If assistant GET works but POST gives 405: POST handler issue');
    console.log('- If all fail: Server/routing problem');
}

runTests().catch(console.error); 