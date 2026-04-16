const { chromium } = require('playwright');

async function testScrape() {
    console.log('🚀 Launching browser to test Peak XV...');

    // Headless: false so you can watch the scroll
    const browser = await chromium.launch({ headless: false }); 
    const page = await browser.newPage();

    try {
        console.log('📡 Navigating to Peak XV...');
        await page.goto('https://careers.peakxv.com/jobs?skills=Node.js', { waitUntil: 'networkidle' });

        // 1. Give it a moment to load any iframes/dynamic content
        await page.waitForTimeout(3000);

        // 2. Scroll to trigger lazy loading
        console.log('🖱️ Scrolling to load jobs...');
        await page.mouse.wheel(0, 1000);
        await page.waitForTimeout(2000);

        console.log('🔍 Extracting jobs...');

        const jobs = await page.evaluate(() => {
            const results = [];
            
            // Peak XV often uses [data-test="job-card"] or <a> tags with specific paths
            const cards = document.querySelectorAll('a[href*="/jobs/"], [data-test="job-listing"], article');

            cards.forEach(card => {
                // We extract text from the card or the nearest parent container
                const text = card.innerText || "";
                const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

                // Most job cards have: Title (line 0), Company (line 1 or 2)
                const title = lines[0] || "Unknown Title";
                const company = lines[1] || "Unknown Company";
                const link = card.href || (card.querySelector('a') ? card.querySelector('a').href : null);

                const isMatch = title.toLowerCase().includes('node') || 
                                title.toLowerCase().includes('backend') ||
                                text.toLowerCase().includes('backend engineer');

                if (isMatch && link) {
                    results.push({
                        title: title.substring(0, 50), // Clean up long strings
                        company: company.substring(0, 30),
                        link: link
                    });
                }
            });

            // Deduplicate by link
            return Array.from(new Map(results.map(item => [item.link, item])).values());
        });

        if (jobs.length > 0) {
            console.log(`\n✅ Success! Found ${jobs.length} Node/Backend roles:`);
            console.table(jobs);
        } else {
            console.log('\n⚠️ Still 0 matches. Let\'s try widening the search to "Engineer" to verify selectors.');
        }

    } catch (err) {
        console.error('❌ Scrape Failed:', err.message);
    } finally {
        console.log('\nClosing in 5 seconds...');
        await new Promise(r => setTimeout(r, 5000));
        await browser.close();
    }
}

testScrape();