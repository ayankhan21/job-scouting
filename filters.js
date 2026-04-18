const SENIORITY_BLACKLIST = [
  "senior",
  "lead",
  "staff",
  "principal",
  "head",
  "manager",
  "director",
  "vp ",
  "vice president",
  "architect",
  "founding engineer",
];

const REQUIRED_STACK = [
  "node",
  "nodejs",
  "node.js",
  "nestjs",
  "nest.js",
  "express",
  "expressjs",
  "backend",
  "back-end",
  "fullstack",
  "full-stack",
  "full stack",
];

const JAVA_KEYWORDS = ["java"];

const JAVA_REQUIRES_ALONGSIDE = [
  "node",
  "nodejs",
  "node.js",
  "nestjs",
  "nest.js",
  "express",
];

function normalize(text) {
  return (text || "").toLowerCase();
}

function containsAny(text, keywords) {
  const normalized = normalize(text);
  return keywords.some((kw) => normalized.includes(kw));
}

function isTooSenior(job) {
  const combined = `${job.title} ${job.full_jd || ""}`;
  // Check title first — if title has seniority, hard reject
  if (containsAny(job.title, SENIORITY_BLACKLIST)) return true;
  return false;
}

function hasRequiredStack(job) {
  const combined = `${job.title} ${job.full_jd || ""}`;
  return containsAny(combined, REQUIRED_STACK);
}

function isJavaOnlyRole(job) {
  const combined = normalize(`${job.title} ${job.full_jd || ""}`);
  const hasJava = JAVA_KEYWORDS.some((kw) => combined.includes(kw));
  if (!hasJava) return false; // not a java role at all, not our concern here

  // It's a Java role — only allow if Node/Nest/Express also mentioned
  const hasAllowedStack = JAVA_REQUIRES_ALONGSIDE.some((kw) =>
    combined.includes(kw)
  );
  return !hasAllowedStack; // true = java only = reject
}

function passesFilter(job) {
  if (isTooSenior(job)) {
    return { pass: false, reason: "Seniority mismatch" };
  }

  if (isJavaOnlyRole(job)) {
    return { pass: false, reason: "Java-only role" };
  }

  if (!hasRequiredStack(job)) {
    return { pass: false, reason: "Stack mismatch" };
  }

  return { pass: true, reason: null };
}

module.exports = { passesFilter };