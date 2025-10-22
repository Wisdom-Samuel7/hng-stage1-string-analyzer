/**
 * String Analyzer Service - Single-file implementation (index.js)
 *
 * Features:
 * - POST /strings          : create/analyze string (409 if exists)
 * - GET  /strings/:value   : fetch a specific string analysis
 * - GET  /strings          : fetch all analyses with filters
 * - GET  /strings/filter-by-natural-language?query=...
 * - DELETE /strings/:value : delete a string entry
 *
 * Persistence: writes to ./strings.json (created automatically).
 *
 * Usage:
 * 1. npm init -y
 * 2. npm install express body-parser
 * 3. node index.js
 *
 * By default listens on PORT=3000 (change via env PORT).
 */

const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(bodyParser.json());

// Persistence file
const DATA_FILE = path.join(__dirname, 'strings.json');

// In-memory store: Map<sha256, record>
const store = new Map();

// Load persisted data if present
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const arr = JSON.parse(raw);
      arr.forEach((rec) => {
        if (rec && rec.properties && rec.id) {
          store.set(rec.id, rec);
        }
      });
      console.log(`Loaded ${store.size} records from ${DATA_FILE}`);
    }
  } catch (err) {
    console.error('Failed to load data file:', err);
  }
}

// Save current store to file
function persistData() {
  try {
    const arr = Array.from(store.values());
    fs.writeFileSync(DATA_FILE, JSON.stringify(arr, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to persist data:', err);
  }
}

// Utilities

function sha256Hex(s) {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

function countWords(s) {
  // split by any whitespace, filter out empty strings
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
  const set = new Set([...s]);
  return set.size;
}

function isPalindromeCaseInsensitive(s) {
  // The spec says case-insensitive palindrome; keep spaces/punctuation as-is (only case folds)
  const folded = s.toLowerCase();
  const rev = folded.split('').reverse().join('');
  return folded === rev;
}

function nowISO() {
  return new Date().toISOString();
}

function analyzeString(value) {
  const props = {
    length: value.length,
    is_palindrome: isPalindromeCaseInsensitive(value),
    unique_characters: uniqueCharacterCount(value),
    word_count: countWords(value),
    sha256_hash: sha256Hex(value),
    character_frequency_map: characterFrequencyMap(value),
  };
  return props;
}

// Find record by exact value (value match)
function findRecordByValue(value) {
  for (const rec of store.values()) {
    if (rec.value === value) return rec;
  }
  return null;
}

// --- Validation helpers ---
function badRequest(res, message) {
  return res.status(400).json({ error: message });
}
function unprocessable(res, message) {
  return res.status(422).json({ error: message });
}
function notFound(res, message = 'String does not exist in the system') {
  return res.status(404).json({ error: message });
}

// --- Endpoints ---

// POST /strings
app.post('/strings', (req, res) => {
  if (!req.is('application/json')) {
    return badRequest(res, 'Content-Type must be application/json');
  }

  if (!req.body || !Object.prototype.hasOwnProperty.call(req.body, 'value')) {
    return badRequest(res, 'Missing "value" field in request body');
  }

  const { value } = req.body;

  if (typeof value !== 'string') {
    return unprocessable(res, '"value" must be a string');
  }

  // Check conflict: string already exists
  const existing = findRecordByValue(value);
  if (existing) {
    return res.status(409).json({ error: 'String already exists in the system' });
  }

  const props = analyzeString(value);
  const id = props.sha256_hash;
  const created_at = nowISO();

  const record = {
    id,
    value,
    properties: props,
    created_at,
  };

  store.set(id, record);
  persistData();

  return res.status(201).json(record);
});


// GET /strings  with filters
// supported query params: is_palindrome (true/false), min_length (int), max_length (int),
// word_count (int exact), contains_character (single char)
app.get('/strings', (req, res) => {
  const q = req.query;

  // Parse and validate query params
  const filters = {};

  if (q.is_palindrome !== undefined) {
    const v = q.is_palindrome.toLowerCase();
    if (v !== 'true' && v !== 'false') {
      return badRequest(res, 'is_palindrome must be "true" or "false"');
    }
    filters.is_palindrome = v === 'true';
  }

  if (q.min_length !== undefined) {
    const n = Number(q.min_length);
    if (!Number.isInteger(n) || n < 0) {
      return badRequest(res, 'min_length must be a non-negative integer');
    }
    filters.min_length = n;
  }

  if (q.max_length !== undefined) {
    const n = Number(q.max_length);
    if (!Number.isInteger(n) || n < 0) {
      return badRequest(res, 'max_length must be a non-negative integer');
    }
    filters.max_length = n;
  }

  if (q.word_count !== undefined) {
    const n = Number(q.word_count);
    if (!Number.isInteger(n) || n < 0) {
      return badRequest(res, 'word_count must be a non-negative integer');
    }
    filters.word_count = n;
  }

  if (q.contains_character !== undefined) {
    const ch = q.contains_character;
    if (typeof ch !== 'string' || ch.length === 0) {
      return badRequest(res, 'contains_character must be a non-empty string');
    }
    // We'll check presence anywhere within the string value; user might expect case-sensitive:
    // use exact character as provided.
    filters.contains_character = ch;
  }

  // Apply filters
  let results = Array.from(store.values());

  if (filters.is_palindrome !== undefined) {
    results = results.filter(r => r.properties.is_palindrome === filters.is_palindrome);
  }
  if (filters.min_length !== undefined) {
    results = results.filter(r => r.properties.length >= filters.min_length);
  }
  if (filters.max_length !== undefined) {
    results = results.filter(r => r.properties.length <= filters.max_length);
  }
  if (filters.word_count !== undefined) {
    results = results.filter(r => r.properties.word_count === filters.word_count);
  }
  if (filters.contains_character !== undefined) {
    const ch = filters.contains_character;
    results = results.filter(r => r.value.includes(ch));
  }

  const response = {
    data: results,
    count: results.length,
    filters_applied: filters,
  };

  return res.status(200).json(response);
});

// GET /strings/filter-by-natural-language?query=...
// Heuristics parser for a few example phrases listed in the spec.
app.get('/strings/filter-by-natural-language', (req, res) => {
  const query = req.query.query;
  if (!query || typeof query !== 'string') {
    return badRequest(res, 'Missing "query" parameter (natural language string)');
  }

  const original = query;
  const lower = query.toLowerCase();

  // parsed_filters will be a subset of supported filters:
  const parsed_filters = {};

  // Heuristic patterns (expandable)
  try {
    // "single word" or "single-word" -> word_count = 1
    if (/\bsingle[- ]word\b/.test(lower) || /\bone[- ]word\b/.test(lower) || /\bsingleword\b/.test(lower)) {
      parsed_filters.word_count = 1;
    }

    // "palindromic" or "palindrome" -> is_palindrome true
    if (/\bpalindrom(e|romic)\b/.test(lower) || /\bpalindromic\b/.test(lower)) {
      parsed_filters.is_palindrome = true;
    }

    // "strings longer than N characters" or "strings longer than 10 characters"
    let m;
    if ((m = lower.match(/\blonger than\s+(\d+)\s+characters\b/))) {
      const n = Number(m[1]);
      parsed_filters.min_length = n + 1; // longer than N => min_length = N+1
    } else if ((m = lower.match(/\bstrings longer than\s+(\d+)\b/))) {
      const n = Number(m[1]);
      parsed_filters.min_length = n + 1;
    } else if ((m = lower.match(/\blonger than\s+(\d+)\b/))) {
      const n = Number(m[1]);
      parsed_filters.min_length = n + 1;
    }

    // "strings containing the letter X" or "containing the letter z" or "containing z"
    if ((m = lower.match(/\bcontains? (?:the )?letter\s+([a-z0-9])\b/)) || (m = lower.match(/\bcontaining\s+([a-z0-9])\b/)) || (m = lower.match(/\bcontains?\s+([a-z0-9])\b/))) {
      parsed_filters.contains_character = m[1];
    }

    // "strings containing the first vowel" -> choose 'a' as heuristic
    if (/\bcontains? the first vowel\b/.test(lower) || /\bcontain the first vowel\b/.test(lower) || /\bcontain first vowel\b/.test(lower)) {
      parsed_filters.contains_character = 'a';
    }

    // "strings with length between X and Y" or "between 5 and 10 characters"
    if ((m = lower.match(/\bbetween\s+(\d+)\s+and\s+(\d+)\s+characters\b/)) || (m = lower.match(/\bbetween\s+(\d+)\s+and\s+(\d+)\b/))) {
      parsed_filters.min_length = Number(m[1]);
      parsed_filters.max_length = Number(m[2]);
    }

    // If no recognized filters found -> return 400
    if (Object.keys(parsed_filters).length === 0) {
      return res.status(400).json({ error: 'Unable to parse natural language query' });
    }

    // Validate parsed filters for contradictions: e.g., min_length > max_length
    if (parsed_filters.min_length !== undefined && parsed_filters.max_length !== undefined) {
      if (parsed_filters.min_length > parsed_filters.max_length) {
        return res.status(422).json({ error: 'Query parsed but resulted in conflicting filters' });
      }
    }

    // Apply parsed_filters to store
    let results = Array.from(store.values());
    if (parsed_filters.is_palindrome !== undefined) {
      results = results.filter(r => r.properties.is_palindrome === parsed_filters.is_palindrome);
    }
    if (parsed_filters.word_count !== undefined) {
      results = results.filter(r => r.properties.word_count === parsed_filters.word_count);
    }
    if (parsed_filters.min_length !== undefined) {
      results = results.filter(r => r.properties.length >= parsed_filters.min_length);
    }
    if (parsed_filters.max_length !== undefined) {
      results = results.filter(r => r.properties.length <= parsed_filters.max_length);
    }
    if (parsed_filters.contains_character !== undefined) {
      results = results.filter(r => r.value.includes(parsed_filters.contains_character));
    }

    return res.status(200).json({
      data: results,
      count: results.length,
      interpreted_query: {
        original,
        parsed_filters,
      },
    });
  } catch (err) {
    console.error('Error parsing natural language query:', err);
    return res.status(400).json({ error: 'Unable to parse natural language query' });
  }
});

// Root health
app.get('/', (req, res) => {
  res.json({ status: 'ok', records: store.size });
});


// GET /strings/:string_value  (value passed in path; expects encoded)
app.get('/strings/:value', (req, res) => {
  // path param is encoded; express decodes it
  const value = req.params.value;
  const rec = findRecordByValue(value);
  if (!rec) return notFound(res);
  return res.status(200).json(rec);
});

// DELETE /strings/:string_value
app.delete('/strings/:value', (req, res) => {
  const value = req.params.value;
  const rec = findRecordByValue(value);
  if (!rec) return notFound(res);
  store.delete(rec.id);
  persistData();
  return res.status(204).send();
});

// Start
loadData();
const PORT = parseInt(process.env.PORT || '3000', 10);
app.listen(PORT, () => {
  console.log(`String Analyzer Service listening on port ${PORT}`);
  console.log(`POST /strings to create; GET /strings to list; GET/DELETE /strings/:value`);
});
