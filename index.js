require("dotenv").config();
const { chromium } = require("playwright");
const { initDb } = require("./db");
const { scrapeGetro } = require("./scrapers/getro");
const { scrapeCutshort } = require("./scrapers/cutshort");
const { scrapeYC } = require("./scrapers/yc");

async function runScout() {
  console.log("🚀 Starting Job Scout...");
  console.log(`🕐 ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}\n`);

  // Init DB
  try {
    await initDb();
    console.log("✅ Database ready\n");
  } catch (err) {
    console.error("❌ Database init failed:", err.message);
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // Block unnecessary resources to speed up scraping
  await page.route("**/*", (route) => {
    const blocked = ["image", "media", "font", "stylesheet"];
    if (blocked.includes(route.request().resourceType())) {
      route.abort();
    } else {
      route.continue();
    }
  });

  const totalStats = { added: 0, skipped: 0, filtered: 0 };

  // --- Group 1: Getro VC Boards ---
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📂 Group 1: Getro VC Boards");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  try {
    const stats = await scrapeGetro(page);
    totalStats.added += stats.added;
    totalStats.skipped += stats.skipped;
    totalStats.filtered += stats.filtered;
  } catch (err) {
    console.error("❌ Getro group failed:", err.message);
  }

  // --- Group 2: Cutshort ---
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📂 Group 2: Cutshort");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  try {
    const stats = await scrapeCutshort(page);
    totalStats.added += stats.added;
    totalStats.skipped += stats.skipped;
    totalStats.filtered += stats.filtered;
  } catch (err) {
    console.error("❌ Cutshort group failed:", err.message);
  }

  // --- Group 3: YC Work at a Startup ---
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📂 Group 3: YC Work at a Startup");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  try {
    const stats = await scrapeYC(page);
    totalStats.added += stats.added;
    totalStats.skipped += stats.skipped;
    totalStats.filtered += stats.filtered;
  } catch (err) {
    console.error("❌ YC group failed:", err.message);
  }

  await browser.close();

  // Final summary
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📊 Run Summary");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`✅ New jobs added  : ${totalStats.added}`);
  console.log(`⏭️  Already in DB   : ${totalStats.skipped}`);
  console.log(`🚫 Filtered out    : ${totalStats.filtered}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

runScout().catch((err) => {
  console.error("💥 Fatal error:", err.message);
  process.exit(1);
});