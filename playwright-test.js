const { chromium, webkit } = require('playwright');

async function testPlaywright() {
    console.log('🚀 Starting Playwright MCP Test...\n');
    
    // Test Chromium
    console.log('Testing Chromium browser...');
    try {
        const browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        
        await page.goto('https://example.com');
        const title = await page.title();
        console.log(`✅ Chromium: Successfully loaded page with title: "${title}"`);
        
        // Test your FRAUDBUSTER extension test page
        const testPagePath = `file://${__dirname}/test-extension.html`;
        await page.goto(testPagePath);
        const testTitle = await page.title();
        console.log(`✅ Chromium: Successfully loaded local test page: "${testTitle}"`);
        
        await browser.close();
    } catch (error) {
        console.log(`❌ Chromium test failed: ${error.message}`);
    }
    
    // Test WebKit
    console.log('\nTesting WebKit browser...');
    try {
        const browser = await webkit.launch({ headless: true });
        const page = await browser.newPage();
        
        await page.goto('https://example.com');
        const title = await page.title();
        console.log(`✅ WebKit: Successfully loaded page with title: "${title}"`);
        
        await browser.close();
    } catch (error) {
        console.log(`❌ WebKit test failed: ${error.message}`);
    }
    
    console.log('\n🎉 Playwright MCP test completed!');
}

// Run the test
testPlaywright().catch(console.error);