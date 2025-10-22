/**
 * String Analyzer Service - Single-file implementation (index.js)
 *
 * Fixes based on automated test feedback:
 * - correct HTTP status codes (201, 409, 400, 422, 204, 200)
 * - natural language route placed above ':value' route
 * - strict validation for query params and request body
 * - filters implementation
 *
 * Usage:
 * 1. npm init -y
 * 2. npm install express
 * 3. node index.js
 */

const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

const DATA_FILE = path.join(__dirname, 'strings.json');
const store = new Map(); // Map<sha256, record>

function nowISO() {
  return new Date().toISOString();
}

function sha256Hex(s) {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

function countWords(s) {
  if (s.trim() === '') return 0;
  return s.trim().split(/\s+/).length;
}

function characterFrequencyMap(s) {
  const map = {};
  for (const ch of s) {
    map[ch] = (map[ch] || 0) + 1;
  }
  return map;
}

function uniqueCharacterCount(s) {
  return new Set([...s]).size;
}

function isPalindromeCaseInsensitive(s) {
  const folded = s.toLowerCase();
  return folded === folded.split('').reverse().join('');
}

function analyzeString(value) {
  const h = sha256Hex(value);
  return {
    length: value.length,
    is_palindrome: isPalindromeCaseInsensitive(value),
    unique_characters: uniqueCharacterCount(value),
    word_count: countWords(value),
    sha256_hash: h,
    character_frequency_map: characterFrequencyMap(value),
  };
}

function persistData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(Array.from(store.values()), null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to persist data:', e);
  }
}

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const arr = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      if (Array.isArray(arr)) {
        for (const rec of arr) {
          if (rec && rec.id) store.set(rec.id, rec);
        }
      }
    }
  } catch (e) {
    console.error('Failed to load data:', e);
  }
}

// Helper: find record by exact value (case-sensitive exact match)
function findByValue(value) {
  for (const rec of store.values()) {
    if (rec.value === value) return rec;
  }
  return null;
}

// Validation helpers
function send400(res, message) { return res.status(400).json({ error: message }); }
function send422(res, message) { return res.status(422).json({ error: message }); }
function send404(res, message = 'String does not exist in the system') { return res.status(404).json({ error: message }); }

// ------------------ ROUTES ------------------

// Root health
app.get('/', (req, res) => res.json({ status: 'ok', records: store.size }));

// POST /strings
app.post('/strings', (req, res) => {
  if (!req.is('application/json')) {
    return send400(res, 'Content-Type must be application/json');
  }
  if (!req.body || !Object.prototype.hasOwnProperty.call(req.body, 'value')) {
    return send400(res, 'Missing "value" field in request body');
  }
  const { value } = req.body;
  if (typeof value !== 'string') {
    return send422(res, '"value" must be a string');
  }

  // Check existing by exact value
  const existing = findByValue(value);
  if (existing) {
    return res.status(409).json({ error: 'String already exists in the system' });
  }

  const props = analyzeString(value);
  const rec = {
    id: props.sha256_hash,
    value,
    properties: props,
    created_at: nowISO(),
  };

  store.set(rec.id, rec);
  persistData();
  return res.status(201).json(rec);
});

// GET /strings - list with filters
app.get('/strings', (req, res) => {
  const q = req.query;
  const filters = {};

  // is_palindrome
  if (q.is_palindrome !== undefined) {
    const v = String(q.is_palindrome).toLowerCase();
    if (v !== 'true' && v !== 'false') return send400(res, 'is_palindrome must be "true" or "false"');
    filters.is_palindrome = v === 'true';
  }

  // min_length
  if (q.min_length !== undefined) {
    const n = Number(q.min_length);
    if (!Number.isInteger(n) || n < 0) return send400(res, 'min_length must be a non-negative integer');
    filters.min_length = n;
  }

  // max_length
  if (q.max_length !== undefined) {
    const n = Number(q.max_length);
    if (!Number.isInteger(n) || n < 0) return send400(res, 'max_length must be a non-negative integer');
    filters.max_length = n;
  }

  // word_count
  if (q.word_count !== undefined) {
    const n = Number(q.word_count);
    if (!Number.isInteger(n) || n < 0) return send400(res, 'word_count must be a non-negative integer');
    filters.word_count = n;
  }

  // contains_character
  if (q.contains_character !== undefined) {
    const ch = String(q.contains_character);
    if (ch.length !== 1) return send400(res, 'contains_character must be a single character');
    filters.contains_character = ch;
  }

  if (filters.min_length !== undefined && filters.max_length !== undefined) {
    if (filters.min_length > filters.max_length) return send422(res, 'min_length cannot be greater than max_length');
  }

  let results = Array.from(store.values());
  if (filters.is_palindrome !== undefined) results = results.filter(r => r.properties.is_palindrome === filters.is_palindrome);
  if (filters.min_length !== undefined) results = results.filter(r => r.properties.length >= filters.min_length);
  if (filters.max_length !== undefined) results = results.filter(r => r.properties.length <= filters.max_length);
  if (filters.word_count !== undefined) results = results.filter(r => r.properties.word_count === filters.word_count);
  if (filters.contains_character !== undefined) results = results.filter(r => r.value.includes(filters.contains_character));

  return res.status(200).json({
    data: results,
    count: results.length,
    filters_applied: filters,
  });
});

// GET /strings/filter-by-natural-language?query=...
// MUST be above /strings/:value to avoid :value route swallowing it
app.get('/strings/filter-by-natural-language', (req, res) => {
  const { query } = req.query;
  if (!query || typeof query !== 'string') return send400(res, 'Missing "query" parameter');

  const lower = query.toLowerCase();
  const parsed = {};

  // single-word or one-word -> word_count = 1
  if (/\b(single|one)[ -]?word\b/.test(lower)) parsed.word_count = 1;

  // palindromic / palindrome
  if (/\bpalindrom(e|ic|ically)?\b/.test(lower)) parsed.is_palindrome = true;

  // longer than N characters
  let m;
  if ((m = lower.match(/\blonger than\s+(\d+)\s+characters\b/)) || (m = lower.match(/\blonger than\s+(\d+)\b/))) {
    parsed.min_length = Number(m[1]) + 1;
  }
  // "strings longer than 10 characters" -> min_length = 11
  if ((m = lower.match(/\bstrings longer than\s+(\d+)\b/))) {
    parsed.min_length = Number(m[1]) + 1;
  }

  // between X and Y characters
  if ((m = lower.match(/\bbetween\s+(\d+)\s+and\s+(\d+)\s+characters\b/)) || (m = lower.match(/\bbetween\s+(\d+)\s+and\s+(\d+)\b/))) {
    parsed.min_length = Number(m[1]);
    parsed.max_length = Number(m[2]);
  }

  // contains letter X or containing X
  if ((m = lower.match(/\bcontains?\s+(?:the\s+)?letter\s+([a-z0-9])\b/)) ||
      (m = lower.match(/\bcontaining\s+([a-z0-9])\b/)) ||
      (m = lower.match(/\bcontains?\s+([a-z0-9])\b/))) {
    parsed.contains_character = m[1];
  }

  // contains the first vowel
  if (/\bcontains?\s+(?:the\s+)?first\s+vowel\b/.test(lower)) parsed.contains_character = 'a';

  // If nothing parsed -> unable to parse
  if (Object.keys(parsed).length === 0) return send400(res, 'Unable to parse natural language query');

  // Validate parsed
  if (parsed.min_length !== undefined && parsed.max_length !== undefined && parsed.min_length > parsed.max_length) {
    return send422(res, 'Query parsed but resulted in conflicting filters');
  }

  // Apply parsed filters
  let results = Array.from(store.values());
  if (parsed.is_palindrome !== undefined) results = results.filter(r => r.properties.is_palindrome === parsed.is_palindrome);
  if (parsed.word_count !== undefined) results = results.filter(r => r.properties.word_count === parsed.word_count);
  if (parsed.min_length !== undefined) results = results.filter(r => r.properties.length >= parsed.min_length);
  if (parsed.max_length !== undefined) results = results.filter(r => r.properties.length <= parsed.max_length);
  if (parsed.contains_character !== undefined) results = results.filter(r => r.value.includes(parsed.contains_character));

  return res.status(200).json({
    data: results,
    count: results.length,
    interpreted_query: {
      original: query,
      parsed_filters: parsed,
    },
  });
});

// GET /strings/:value (must be after filter routes)
app.get('/strings/:value', (req, res) => {
  const value = req.params.value;
  const rec = findByValue(value);
  if (!rec) return send404(res);
  return res.status(200).json(rec);
});

// DELETE /strings/:value
app.delete('/strings/:value', (req, res) => {
  const value = req.params.value;
  const rec = findByValue(value);
  if (!rec) return send404(res);
  store.delete(rec.id);
  persistData();
  return res.status(204).send();
});

// Load persisted data & start
loadData();

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => {
  console.log(`String Analyzer Service listening on ${PORT} — records=${store.size}`);
});
