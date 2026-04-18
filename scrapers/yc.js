const { passesFilter } = require("../filters");
const { jobExists, insertJob } = require("../db");
const source = require("../registry/yc");

async function waitForJobCards(page, timeout = 15000) {
  const selectors = [
    ".job-name",
    '[class*="job"]',
    ".company-jobs-table",
  ];

  const start = Date.now();

  while (Date.now() - start < timeout) {
    for (const sel of selectors) {
      const count = await page.evaluate((s) => {
        return document.querySelectorAll(s).length;
      }, sel);

      if (count > 0) return { count, selector: sel };
    }
    await page.waitForTimeout(500);
  }

  return { count: 0, selector: null };
}

async function scrapeYC(page) {
  const stats = { added: 0, skipped: 0, filtered: 0 };

  try {
    console.log(`\n📡 Scraping YC Work at a Startup...`);
    await page.goto(source.url, { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(2000);

    const { count, selector } = await waitForJobCards(page);

    if (count === 0) {
      console.log("⚠️  No job cards found on YC");
      return stats;
    }

    console.log(`✅ Found ${count} cards`);

    const jobs = await page.evaluate(() => {
      const results = [];

      // YC list-compact layout groups jobs under company rows
      const jobRows = document.querySelectorAll(".job");

      jobRows.forEach((row) => {
        const titleEl = row.querySelector(".job-name, a");
        const linkEl = row.querySelector("a[href]");
        const companyEl = row.closest("[class*='company']")?.querySelector(
          ".company-name, h2, h3"
        );
        const locationEl = row.querySelector(
          ".job-location, [class*='location']"
        );

        if (!titleEl || !linkEl) return;

        const href = linkEl.getAttribute("href");
        const link = href.startsWith("http")
          ? href
          : `https://www.workatastartup.com${href}`;

        const locationText = locationEl ? locationEl.innerText.trim() : null;

        results.push({
          title: titleEl.innerText.trim(),
          company: companyEl ? companyEl.innerText.trim() : "Unknown",
          link,
          location: locationText,
          posted_at: null, // not available in list view
          full_jd: null,   // no login, skip JD fetch
        });
      });

      return results;
    });

    for (const job of jobs) {
      job.source = source.name;
      job.is_remote = job.location
        ? job.location.toLowerCase().includes("remote")
        : false;

      const exists = await jobExists(job.link);
      if (exists) {
        stats.skipped++;
        continue;
      }

      // No JD available without login — filter on title only
      const filter = passesFilter(job);
      if (!filter.pass) {
        console.log(`🚫 Filtered [${filter.reason}]: ${job.title} @ ${job.company}`);
        stats.filtered++;
        continue;
      }

      const inserted = await insertJob(job);
      if (inserted) {
        console.log(`✅ Added: ${job.title} @ ${job.company}`);
        stats.added++;
      }
    }
  } catch (err) {
    console.error(`❌ YC failed: ${err.message}`);
  }

  return stats;
}

module.exports = { scrapeYC };