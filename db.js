const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const DB_PATH = path.join(__dirname, "jobs.db");

function getDb() {
  return new sqlite3.Database(DB_PATH);
}

function initDb() {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.run(
      `CREATE TABLE IF NOT EXISTS jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        company TEXT,
        link TEXT UNIQUE NOT NULL,
        source TEXT,
        location TEXT,
        is_remote INTEGER DEFAULT 0,
        posted_at TEXT,
        full_jd TEXT,
        first_seen_at TEXT DEFAULT (datetime('now', 'localtime'))
      )`,
      (err) => {
        db.close();
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

function jobExists(link) {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.get(`SELECT id FROM jobs WHERE link = ?`, [link], (err, row) => {
      db.close();
      if (err) reject(err);
      else resolve(!!row);
    });
  });
}

function insertJob(job) {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.run(
      `INSERT OR IGNORE INTO jobs (title, company, link, source, location, is_remote, posted_at, full_jd)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        job.title,
        job.company,
        job.link,
        job.source,
        job.location,
        job.is_remote ? 1 : 0,
        job.posted_at || null,
        job.full_jd || null,
      ],
      function (err) {
        db.close();
        if (err) reject(err);
        else resolve(this.changes); // 1 if inserted, 0 if duplicate
      }
    );
  });
}

function getAllJobs() {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.all(
      `SELECT * FROM jobs ORDER BY first_seen_at DESC`,
      [],
      (err, rows) => {
        db.close();
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
}

function clearAllJobs() {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.run(`DELETE FROM jobs`, [], function (err) {
      db.close();
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
}

function getJobCount() {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.get(`SELECT COUNT(*) as count FROM jobs`, [], (err, row) => {
      db.close();
      if (err) reject(err);
      else resolve(row.count);
    });
  });
}

module.exports = { initDb, jobExists, insertJob, getAllJobs, clearAllJobs, getJobCount };