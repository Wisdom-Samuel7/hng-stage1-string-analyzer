import crypto from "crypto";

export function analyzeString(value) {
  const clean = value.trim();

  // Palindrome check
  const reversed = clean.split("").reverse().join("");
  const is_palindrome = clean.toLowerCase() === reversed.toLowerCase();

  // Unique characters
  const unique_characters = new Set(clean).size;

  // Word count
  const word_count = clean.split(/\s+/).filter(Boolean).length;

  // SHA-256 hash
  const sha256_hash = crypto.createHash("sha256").update(clean).digest("hex");

  // Character frequency
  const character_frequency_map = {};
  for (const char of clean) {
    character_frequency_map[char] =
      (character_frequency_map[char] || 0) + 1;
  }

  return {
    length: clean.length,
    is_palindrome,
    unique_characters,
    word_count,
    sha256_hash,
    character_frequency_map,
  };
}
