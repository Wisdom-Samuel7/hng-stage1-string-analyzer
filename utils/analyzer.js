import crypto from "crypto";

/**
 * Analyze a given string and return computed properties
 */
export function analyzeString(value) {
  const clean = value.trim();

  // ✅ Length
  const length = clean.length;

  // ✅ Palindrome check (case-insensitive)
  const reversed = clean.split("").reverse().join("");
  const is_palindrome = clean.toLowerCase() === reversed.toLowerCase();

  // ✅ Unique characters
  const unique_characters = new Set(clean).size;

  // ✅ Word count (split on whitespace)
  const word_count = clean.split(/\s+/).filter(Boolean).length;

  // ✅ SHA-256 hash
  const sha256_hash = crypto.createHash("sha256").update(clean).digest("hex");

  // ✅ Character frequency map
  const character_frequency_map = {};
  for (const char of clean) {
    character_frequency_map[char] = (character_frequency_map[char] || 0) + 1;
  }

  return {
    length,
    is_palindrome,
    unique_characters,
    word_count,
    sha256_hash,
    character_frequency_map,
  };
}
