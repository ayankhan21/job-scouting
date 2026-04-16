const { chromium } = require("playwright");
const { initDb } = require("./db"); // We'll keep this ready for later

async function runScout() {
  console.log("🚀 Starting manual scout...");

  // 1. Launch Browser (Headless: false so you can see it work!)
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    // 2. Navigate to Peak XV (Sequoia) Job Board
    console.log("📡 Navigating to Peak XV...");
    await page.goto("https://careers.peakxv.com/jobs", {
      waitUntil: "networkidle",
    });

    // 3. Wait for the job listings to load
    // Getro-based boards usually use 'article' or specific classes
    await page.waitForSelector(".jobs-list-item, article", { timeout: 10000 });

    // 4. Extract Job Data
    const jobs = await page.evaluate(() => {
      const results = [];
      // This selector targets the common Getro job card structure
      const items = document.querySelectorAll(".jobs-list-item");

      items.forEach((item) => {
        const title = item.querySelector(".job-title")?.innerText.trim();
        const company = item.querySelector(".company-name")?.innerText.trim();
        const link = item.querySelector("a")?.href;
        const location = item.querySelector(".location")?.innerText.trim();

        // Simple filter for Node/Backend
        if (
          title &&
          (title.toLowerCase().includes("node") ||
            title.toLowerCase().includes("backend"))
        ) {
          results.push({ title, company, link, location });
        }
      });
      return results;
    });

    // 5. Output Results
    console.log(`\n✅ Found ${jobs.length} potential matches:\n`);
    console.table(jobs);
  } catch (error) {
    console.error("❌ Error during scrape:", error.message);
  } finally {
    console.log("\n⌛ Closing browser in 5 seconds...");
    await new Promise((r) => setTimeout(r, 5000));
    await browser.close();
  }
}

runScout();
