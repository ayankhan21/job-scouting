require("dotenv").config();
const readline = require("readline");
const { initDb, clearAllJobs, getJobCount } = require("./db");

async function clearJobs() {
  await initDb();

  const count = await getJobCount();

  if (count === 0) {
    console.log("📭 Database is already empty.");
    return;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question(
    `⚠️  This will delete all ${count} stored jobs. Are you sure? (yes/no): `,
    async (answer) => {
      rl.close();

      if (answer.trim().toLowerCase() === "yes") {
        const deleted = await clearAllJobs();
        console.log(`🗑️  Cleared ${deleted} jobs from the database.`);
      } else {
        console.log("❌ Aborted. No data was deleted.");
      }
    }
  );
}

clearJobs().catch((err) => {
  console.error("❌ Error clearing jobs:", err.message);
  process.exit(1);
});