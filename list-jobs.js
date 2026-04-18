require("dotenv").config();
const { initDb, getAllJobs } = require("./db");

async function listJobs() {
  await initDb();
  const jobs = await getAllJobs();

  if (jobs.length === 0) {
    console.log("📭 No jobs stored yet.");
    return;
  }

  console.log(`\n📋 Stored Jobs (${jobs.length} total)\n`);

  jobs.forEach((job, i) => {
    console.log(`─────────────────────────────────────────`);
    console.log(`#${i + 1} ${job.title}`);
    console.log(`🏢 Company   : ${job.company || "Unknown"}`);
    console.log(`📌 Source    : ${job.source}`);
    console.log(`📍 Location  : ${job.location || "Not specified"}${job.is_remote ? " (Remote)" : ""}`);
    console.log(`📅 Posted    : ${job.posted_at || "Unknown"}`);
    console.log(`🕐 First Seen: ${job.first_seen_at}`);
    console.log(`🔗 Link      : ${job.link}`);
    if (job.full_jd) {
      console.log(`📄 JD Preview: ${job.full_jd.slice(0, 150).replace(/\n/g, " ")}...`);
    }
  });

  console.log(`─────────────────────────────────────────\n`);
}

listJobs().catch((err) => {
  console.error("❌ Error listing jobs:", err.message);
  process.exit(1);
});