const { passesFilter } = require("../filters");
const { jobExists, insertJob } = require("../db");
const source = require("../registry/cutshort");

async function injectCookies(page) {
  console.log("🍪 Injecting Cutshort session cookies...");

  await page.context().addCookies([
    {
      name: "cutshort_authentication",
      value: process.env.CUTSHORT_AUTH,
      domain: "cutshort.io",
      path: "/",
    },
    {
      name: "cssid",
      value: process.env.CUTSHORT_CSSID,
      domain: "cutshort.io",
      path: "/",
    },
    {
      name: "XSRF-TOKEN",
      value: process.env.CUTSHORT_XSRF,
      domain: "cutshort.io",
      path: "/",
    },
  ]);

  console.log("✅ Cookies injected");
}

async function waitForJobCards(page, timeout = 15000) {
  const selector = '[class*="jobCard"], [class*="job-card"], [class*="JobCard"]';
  const start = Date.now();
  let lastCount = 0;
  let stableFor = 0;

  while (Date.now() - start < timeout) {
    const count = await page.evaluate((sel) => {
      return document.querySelectorAll(sel).length;
    }, selector);

    if (count > 0 && count === lastCount) {
      stableFor += 500;
      if (stableFor >= 1500) return { count, selector };
    } else {
      stableFor = 0;
    }

    lastCount = count;
    await page.waitForTimeout(500);
  }

  return { count: lastCount, selector };
}

async function scrapeJobDetails(page, url) {
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(1000);

    const details = await page.evaluate(() => {
      const jdEl = document.querySelector(
        '[class*="description"], [class*="jobDetail"], [class*="job-detail"]'
      );
      const locationEl = document.querySelector(
        '[class*="location"], [class*="Location"]'
      );
      const companyEl = document.querySelector(
        '[class*="companyName"], [class*="company-name"], [class*="company"]'
      );

      return {
        full_jd: jdEl ? jdEl.innerText.trim() : null,
        location: locationEl ? locationEl.innerText.trim() : null,
        company: companyEl ? companyEl.innerText.trim() : null,
      };
    });

    return details;
  } catch (err) {
    console.log(`⚠️  Could not fetch JD from ${url}: ${err.message}`);
    return { full_jd: null, location: null, company: null };
  }
}

async function scrapeCutshort(page) {
  const stats = { added: 0, skipped: 0, filtered: 0 };

  try {
    await injectCookies(page);

    console.log(`\n📡 Scraping Cutshort...`);
    await page.goto(source.url, { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(2000);

    // Verify we are actually logged in
    const isLoggedIn = await page.evaluate(() => {
      return !document.querySelector('[href*="login"], [href*="signin"]');
    });

    if (!isLoggedIn) {
      console.log("❌ Cutshort cookie auth failed — session may have expired. Update cookies in .env");
      return stats;
    }

    const { count, selector } = await waitForJobCards(page);

    if (count === 0) {
      console.log("⚠️  No job cards found on Cutshort");
      return stats;
    }

    console.log(`✅ Found ${count} cards`);

    const jobs = await page.evaluate((sel) => {
      const cards = document.querySelectorAll(sel);
      const results = [];

      cards.forEach((card) => {
        const titleEl = card.querySelector('h2, h3, [class*="title"], [class*="Title"]');
        const linkEl = card.querySelector("a[href]");
        const companyEl = card.querySelector('[class*="company"], [class*="Company"]');
        const locationEl = card.querySelector('[class*="location"], [class*="Location"]');
        const postedEl = card.querySelector('[class*="date"], [class*="posted"], time');

        if (!titleEl || !linkEl) return;

        const href = linkEl.getAttribute("href");
        const link = href.startsWith("http")
          ? href
          : `https://cutshort.io${href}`;

        results.push({
          title: titleEl.innerText.trim(),
          company: companyEl ? companyEl.innerText.trim() : "Unknown",
          link,
          location: locationEl ? locationEl.innerText.trim() : null,
          posted_at: postedEl ? postedEl.innerText.trim() : null,
        });
      });

      return results;
    }, selector);

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

      const details = await scrapeJobDetails(page, job.link);
      job.full_jd = details.full_jd;
      job.location = job.location || details.location;
      job.company = job.company !== "Unknown" ? job.company : details.company || "Unknown";

      // navigate back to listing
      await page.goto(source.url, { waitUntil: "networkidle", timeout: 20000 });
      await waitForJobCards(page);

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
    console.error(`❌ Cutshort failed: ${err.message}`);
  }

  return stats;
}

module.exports = { scrapeCutshort };