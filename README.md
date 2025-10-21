# 🧠 HNG Stage 1 — String Analyzer API  

A RESTful **String Analyzer Service** built with **Node.js + Express** for the **HNG Internship (Stage 1 – Backend)**.  
The API analyzes strings, computes their properties, and supports rich filtering — including **natural language queries**.

---

## 🚀 Live API  
> 🔗 **Base URL:** `https://yourapp.pxxl.app`  
> _(Replace with your deployed PXXL App URL)_

---

## 👨‍💻 Developer Information  

| Field | Value |
|-------|--------|
| **Name** | Wisdom Samuel |
| **Email** | knowurcrafts@gmail.com |
| **Stack** | Node.js / Express (MERN Stack) |
| **Brand** | KnowUrCraft |

---

## ⚙️ Features  

- 🔍 Analyze and store strings  
- 🧩 Compute: length, palindrome check, word count, unique characters  
- 🧠 SHA-256 hashing for unique ID  
- 🧮 Character frequency map  
- 🗂️ Filtering by properties and natural language  
- 🌍 CORS-enabled REST API  
- ⚡ In-memory persistence (no DB needed for this stage)

---

## 🧱 Tech Stack  

- **Node.js** — runtime environment  
- **Express.js** — web framework  
- **Crypto** — SHA-256 hashing  
- **CORS** — cross-origin resource sharing  
- **Nodemon** — development hot-reload  

---

## 🧩 API Endpoints  

### 1️⃣ Create / Analyze String  
**POST** `/strings`  

**Request Body**
```json
{
  "value": "string to analyze"
}


Response (201 Created)

{
  "id": "sha256_hash_value",
  "value": "string to analyze",
  "properties": {
    "length": 17,
    "is_palindrome": false,
    "unique_characters": 12,
    "word_count": 3,
    "sha256_hash": "abc123...",
    "character_frequency_map": {
      "s": 2,
      "t": 3,
      "r": 2
    }
  },
  "created_at": "2025-10-19T12:00:00Z"
}


Errors

400 Bad Request – Missing "value"

422 Unprocessable Entity – Invalid data type

409 Conflict – String already exists

2️⃣ Get Specific String

GET /strings/{string_value}

Response (200 OK)

{
  "id": "hash_value",
  "value": "madam",
  "properties": { /* same as above */ },
  "created_at": "2025-10-19T12:00:00Z"
}


Error

404 Not Found – String does not exist

3️⃣ Get All Strings (with Filters)

GET /strings?is_palindrome=true&min_length=5&max_length=20&word_count=2&contains_character=a

Response

{
  "data": [/* filtered results */],
  "count": 15,
  "filters_applied": {
    "is_palindrome": true,
    "min_length": 5,
    "max_length": 20,
    "word_count": 2,
    "contains_character": "a"
  }
}


Error

400 Bad Request – Invalid query parameter

4️⃣ Natural Language Filter

GET /strings/filter-by-natural-language?query=all single word palindromic strings

Response (200 OK)

{
  "data": [
    {
      "id": "f6c47...",
      "value": "madam",
      "properties": { /* same as above */ },
      "created_at": "2025-10-19T21:15:00Z"
    }
  ],
  "count": 1,
  "interpreted_query": {
    "original": "all single word palindromic strings",
    "parsed_filters": {
      "word_count": 1,
      "is_palindrome": true
    }
  }
}


Errors

400 Bad Request – Unable to parse query

422 Unprocessable Entity – Conflicting filters

5️⃣ Delete String

DELETE /strings/{string_value}

Response: 204 No Content

Error

404 Not Found – String does not exist

🧮 Example Character Frequency

For "level up"

{
  "l": 2,
  "e": 2,
  "v": 1,
  " ": 1,
  "u": 1,
  "p": 1
}

🧰 Installation & Setup
1️⃣ Clone Repository
git clone https://github.com/Wisdom-Samuel7/HNG_backend_task_Stage1.git
cd HNG_backend_task_Stage1

2️⃣ Install Dependencies
npm install

3️⃣ Start Development Server
npm run dev


Runs on http://localhost:3000

4️⃣ Start Production Server
npm start

⚙️ Environment Variables
PORT=3000
