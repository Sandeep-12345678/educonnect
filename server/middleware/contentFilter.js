const db = require('../db');

const filterCache = new Set();
const cacheAge = { updated: 0 };

function loadFilterWords() {
  const now = Date.now();
  if (now - cacheAge.updated < 60000) return; // refresh every 60s
  const words = db.prepare('SELECT word FROM content_filter_words').all();
  filterCache.clear();
  words.forEach(w => filterCache.add(w.word.toLowerCase()));
  cacheAge.updated = now;
}

function filterText(text) {
  loadFilterWords();
  let filtered = text;
  let flagged = false;

  for (const word of filterCache) {
    const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    if (regex.test(filtered)) {
      filtered = filtered.replace(regex, match => '*'.repeat(match.length));
      flagged = true;
    }
  }

  return { filtered, flagged };
}

function contentFilter(req, res, next) {
  // Skip filtering for verified adults
  if (req.user && req.user.role === 'verified_adult') {
    req.contentFlagged = false;
    return next();
  }
  
  if (req.body && req.body.content) {
    const result = filterText(req.body.content);
    req.body.content = result.filtered;
    req.contentFlagged = result.flagged;
  }
  next();
}

module.exports = { filterText, contentFilter };
