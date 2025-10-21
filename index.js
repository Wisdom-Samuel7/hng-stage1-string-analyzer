// Import dependencies
import express from "express";
import cors from "cors";
import { analyzeString } from "./utils/analyzer.js";

const app = express();
app.use(cors());
app.use(express.json());

// 🗃️ In-memory storage (temporary)
let storage = [];

// ✅ Root route
app.get("/", (req, res) => {
  res.send("🚀 HNG Stage 1 - String Analyzer API is running! Use /strings");
});


// 🧠 POST /strings → Analyze and store new string
app.post("/strings", (req, res) => {
  const { value } = req.body;

  // Validate input
  if (!value) return res.status(400).json({ error: "Missing 'value' field" });
  if (typeof value !== "string")
    return res.status(422).json({ error: "'value' must be a string" });

  // Check duplicates
  const exists = storage.find((s) => s.value === value);
  if (exists)
    return res.status(409).json({ error: "String already exists in system" });

  // Analyze the string
  const properties = analyzeString(value);
  const created_at = new Date().toISOString();

  // Build response object
  const entry = {
    id: properties.sha256_hash,
    value,
    properties,
    created_at,
  };

  storage.push(entry);
  res.status(201).json(entry);
});


// 🔍 GET /strings/:value → Retrieve a specific string
app.get("/strings/:value", (req, res) => {
  const value = req.params.value;
  const found = storage.find((s) => s.value === value);

  if (!found) return res.status(404).json({ error: "String not found" });

  res.status(200).json(found);
});


// 🧩 GET /strings → Retrieve all strings with filtering
app.get("/strings", (req, res) => {
  const {
    is_palindrome,
    min_length,
    max_length,
    word_count,
    contains_character,
  } = req.query;

  let filtered = [...storage];

  // Apply filters one by one
  if (is_palindrome !== undefined) {
    if (is_palindrome !== "true" && is_palindrome !== "false") {
      return res.status(400).json({
        error: "Invalid value for 'is_palindrome'. Must be true or false",
      });
    }
    filtered = filtered.filter(
      (s) => s.properties.is_palindrome === (is_palindrome === "true")
    );
  }

  if (min_length) {
    const min = Number(min_length);
    if (isNaN(min))
      return res.status(400).json({ error: "'min_length' must be an integer" });
    filtered = filtered.filter((s) => s.properties.length >= min);
  }

  if (max_length) {
    const max = Number(max_length);
    if (isNaN(max))
      return res.status(400).json({ error: "'max_length' must be an integer" });
    filtered = filtered.filter((s) => s.properties.length <= max);
  }

  if (word_count) {
    const words = Number(word_count);
    if (isNaN(words))
      return res.status(400).json({ error: "'word_count' must be an integer" });
    filtered = filtered.filter((s) => s.properties.word_count === words);
  }

  if (contains_character) {
    if (typeof contains_character !== "string" || contains_character.length !== 1)
      return res.status(400).json({
        error: "'contains_character' must be a single character",
      });
    filtered = filtered.filter((s) =>
      s.value.toLowerCase().includes(contains_character.toLowerCase())
    );
  }

  // Response
  res.status(200).json({
    data: filtered,
    count: filtered.length,
    filters_applied: {
      is_palindrome,
      min_length,
      max_length,
      word_count,
      contains_character,
    },
  });
});


// 🗑️ DELETE /strings/:value → Delete a string
app.delete("/strings/:value", (req, res) => {
  const value = req.params.value;
  const index = storage.findIndex((s) => s.value === value);

  if (index === -1)
    return res.status(404).json({ error: "String not found in system" });

  storage.splice(index, 1);
  res.status(204).send();
});


// 🗣️ GET /strings/filter-by-natural-language → interpret plain English queries
app.get("/strings/filter-by-natural-language", (req, res) => {
  const { query } = req.query;

  if (!query || typeof query !== "string") {
    return res.status(400).json({
      error: "Missing or invalid 'query' parameter",
    });
  }

  const lowerQuery = query.toLowerCase();
  const parsedFilters = {};

  // 🧩 Basic rule-based parsing (expandable)
  if (lowerQuery.includes("palindromic") || lowerQuery.includes("palindrome")) {
    parsedFilters.is_palindrome = true;
  }
  if (lowerQuery.includes("single word") || lowerQuery.includes("one word")) {
    parsedFilters.word_count = 1;
  }
  if (lowerQuery.includes("longer than")) {
    const match = lowerQuery.match(/longer than (\d+)/);
    if (match) parsedFilters.min_length = parseInt(match[1]) + 1;
  }
  if (lowerQuery.includes("shorter than")) {
    const match = lowerQuery.match(/shorter than (\d+)/);
    if (match) parsedFilters.max_length = parseInt(match[1]) - 1;
  }
  if (lowerQuery.includes("containing the letter") || lowerQuery.includes("contains the letter")) {
    const match = lowerQuery.match(/letter ([a-zA-Z])/);
    if (match) parsedFilters.contains_character = match[1].toLowerCase();
  }
  if (lowerQuery.includes("containing the first vowel")) {
    parsedFilters.contains_character = "a"; // heuristic: first vowel = 'a'
  }

  // 🛑 No valid keywords detected
  if (Object.keys(parsedFilters).length === 0) {
    return res.status(400).json({
      error: "Unable to parse natural language query",
      hint: "Try phrases like 'all single word palindromic strings'",
    });
  }

  // ♻️ Reuse your existing filtering logic
  let filtered = [...storage];
  if (parsedFilters.is_palindrome !== undefined) {
    filtered = filtered.filter(
      (s) => s.properties.is_palindrome === parsedFilters.is_palindrome
    );
  }
  if (parsedFilters.min_length) {
    filtered = filtered.filter(
      (s) => s.properties.length >= parsedFilters.min_length
    );
  }
  if (parsedFilters.max_length) {
    filtered = filtered.filter(
      (s) => s.properties.length <= parsedFilters.max_length
    );
  }
  if (parsedFilters.word_count) {
    filtered = filtered.filter(
      (s) => s.properties.word_count === parsedFilters.word_count
    );
  }
  if (parsedFilters.contains_character) {
    filtered = filtered.filter((s) =>
      s.value.toLowerCase().includes(parsedFilters.contains_character)
    );
  }

  // ✅ Success response
  return res.status(200).json({
    data: filtered,
    count: filtered.length,
    interpreted_query: {
      original: query,
      parsed_filters: parsedFilters,
    },
  });
});



// 🚀 Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on: http://localhost:${PORT}`);
});
