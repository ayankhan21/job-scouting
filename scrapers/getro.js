const { passesFilter } = require("../filters");
const { jobExists, insertJob } = require("../db");
const sources = require("../registry/getro");

const SELECTORS = {
  v1: "div.job-list-job",
  v2: 'div[data-testid="job-list-item"]',
};

async function scrapeJobDetails(page, url) {
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(1000);

    const jd = await page.evaluate(() => {
      const el = document.querySelector(
        ".job-description, [class*='description'], [class*='jobDetail']",
      );
      return el ? el.innerText.trim() : null;
    });

    return jd;
  } catch (err) {
    console.log(`⚠️  Could not fetch JD from ${url}: ${err.message}`);
    return null;
  }
}

async function waitForCards(page, selector, timeout = 20000) {
  const start = Date.now();
  let lastCount = 0;
  let stableFor = 0;

  while (Date.now() - start < timeout) {
    const count = await page.evaluate((sel) => {
      return document.querySelectorAll(sel).length;
    }, selector);

    if (count > 0 && count === lastCount) {
      stableFor += 500;
      if (stableFor >= 1500) return count;
    } else {
      stableFor = 0;
    }

    lastCount = count;
    await page.waitForTimeout(500);
  }

  return lastCount;
}

function extractJobsV1(cards) {
  const results = [];
  cards.forEach((card) => {
    const titleEl = card.querySelector(".job-list-job-title a");
    const companyEl = card.querySelector(".job-list-job-company-link");
    const linkEl = card.querySelector(".job-list-job-title a");
    const locationEl = card.querySelector(".job-list-badge-locations");
    const postedEl = card.querySelector(".job-list-badge-posted");

    if (!titleEl || !linkEl) return;

    const href = linkEl.getAttribute("href");
    const link = href.startsWith("http")
      ? href
      : `${window.location.origin}${href}`;

    results.push({
      title: titleEl.innerText.trim(),
      company: companyEl ? companyEl.innerText.trim() : "Unknown",
      link,
      location: locationEl ? locationEl.innerText.trim() : null,
      posted_at: postedEl ? postedEl.innerText.trim() : null,
    });
  });
  return results;
}

function extractJobsV2(cards) {
  const results = [];
  cards.forEach((card) => {
    const titleEl = card.querySelector('[itemprop="title"]');
    const linkEl = card.querySelector('[data-testid="job-title-link"]');
    const companyEl = card.querySelector('[itemprop="name"]');
    const locationEl = card.querySelector('[class*="hYaoSM"]');
    const postedEl = card.querySelector('[class*="added"] div[class]');

    if (!titleEl || !linkEl) return;

    const href = linkEl.getAttribute("href");
    const link = href.startsWith("http")
      ? href
      : `https://jobs.accel.com${href}`;

    // collect all location spans
    const locationSpans = card.querySelectorAll('[class*="hYaoSM"]');
    const locationText = Array.from(locationSpans)
      .map((s) => s.innerText.trim())
      .join(", ");

    results.push({
      title: titleEl.innerText.trim(),
      company: companyEl ? companyEl.innerText.trim() : "Unknown",
      link,
      location: locationText || null,
      posted_at: postedEl ? postedEl.innerText.trim() : null,
    });
  });
  return results;
}

async function scrapeGetro(page) {
  const stats = { added: 0, skipped: 0, filtered: 0 };

  for (const source of sources) {
    console.log(`\n📡 Scraping ${source.name}...`);
    const selector = SELECTORS[source.version];

    try {
      // v2 needs longer wait — extra initial pause before checking
      await page.goto(source.url, { waitUntil: "networkidle", timeout: 20000 });
      if (source.version === "v2") {
        console.log(`⏳ v2 board detected, waiting for hydration...`);
        await page.waitForTimeout(4000);
      }

      const count = await waitForCards(page, selector);
      console.log(`🔍 Found ${count} cards for ${source.name}`);

      if (count === 0) {
        console.log(`⚠️  No job cards found for ${source.name}`);
        continue;
      }

      const jobs = await page.evaluate(
        ({ sel, version }) => {
          const cards = document.querySelectorAll(sel);

          function extractV1(cards) {
            const results = [];
            cards.forEach((card) => {
              const titleEl = card.querySelector(".job-list-job-title a");
              const companyEl = card.querySelector(
                ".job-list-job-company-link",
              );
              const linkEl = card.querySelector(".job-list-job-title a");
              const locationEl = card.querySelector(
                ".job-list-badge-locations",
              );
              const postedEl = card.querySelector(".job-list-badge-posted");

              if (!titleEl || !linkEl) return;

              const href = linkEl.getAttribute("href");
              const link = href.startsWith("http")
                ? href
                : `${window.location.origin}${href}`;

              results.push({
                title: titleEl.innerText.trim(),
                company: companyEl ? companyEl.innerText.trim() : "Unknown",
                link,
                location: locationEl ? locationEl.innerText.trim() : null,
                posted_at: postedEl ? postedEl.innerText.trim() : null,
              });
            });
            return results;
          }

          function extractV2(cards) {
            const results = [];
            cards.forEach((card) => {
              const titleEl = card.querySelector('[itemprop="title"]');
              const linkEl = card.querySelector(
                '[data-testid="job-title-link"]',
              );
              const companyEl = card.querySelector('[itemprop="name"]');
              const postedEl = card.querySelector(".added div[class]");

              if (!titleEl || !linkEl) return;

              const href = linkEl.getAttribute("href");
              const link = href.startsWith("http")
                ? href
                : `${window.location.origin}${href}`;

              const locationSpans = card.querySelectorAll('[class*="hYaoSM"]');
              const locationText = Array.from(locationSpans)
                .map((s) => s.innerText.trim())
                .join(", ");

              results.push({
                title: titleEl.innerText.trim(),
                company: companyEl ? companyEl.innerText.trim() : "Unknown",
                link,
                location: locationText || null,
                posted_at: postedEl ? postedEl.innerText.trim() : null,
              });
            });
            return results;
          }

          return version === "v1"
            ? extractV1(Array.from(cards))
            : extractV2(Array.from(cards));
        },
        { sel: selector, version: source.version },
      );

      console.log(`✅ Extracted ${jobs.length} jobs from ${source.name}`);

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

        job.full_jd = await scrapeJobDetails(page, job.link);

        await page.goto(source.url, {
          waitUntil: "networkidle",
          timeout: 20000,
        });
        if (source.version === "v2") await page.waitForTimeout(4000);
        await waitForCards(page, selector);

        const filter = passesFilter(job);
        if (!filter.pass) {
          console.log(
            `🚫 Filtered [${filter.reason}]: ${job.title} @ ${job.company}`,
          );
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
      console.error(`❌ ${source.name} failed: ${err.message}`);
    }
  }

  return stats;
}

module.exports = { scrapeGetro };
