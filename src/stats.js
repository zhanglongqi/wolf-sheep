// ─── Stats persistence ────────────────────────────────────────────────────────

// Task 1.1: storage key + bucket key. ":v1" lets a future incompatible schema
// change move to ":v2" and leave old data orphaned, rather than needing a
// migration — see design.md Decision 4.
const STATS_STORAGE_KEY = "wolf-sheep:stats:v1";

// Two-player mode has no difficulty axis (the AI is never invoked in "2p"),
// so it gets a single shared bucket instead of being split three ways.
function statsBucketKey(mode, difficulty) {
  return mode === "2p" ? "2p" : `${mode}|${difficulty}`;
}

// Task 1.2: read/write/clear helpers. A missing key, unparseable JSON, or a
// thrown access error (e.g. localStorage unavailable) all degrade to "no
// stats" rather than throwing — this is low-stakes local data, not worth
// failing the UI over. See design.md Decision 4.
function readStats() {
  try {
    const raw = window.localStorage.getItem(STATS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStats(stats) {
  try {
    window.localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // localStorage unavailable/full — stats just don't persist this time.
  }
}

function clearStats() {
  try {
    window.localStorage.removeItem(STATS_STORAGE_KEY);
  } catch {
    // Nothing to do if localStorage itself is unavailable.
  }
}

export { statsBucketKey, readStats, writeStats, clearStats };
