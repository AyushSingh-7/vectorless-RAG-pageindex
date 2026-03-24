require("dotenv").config();
const express = require("express");
const axios = require("axios");
const fs = require("fs");
const FormData = require("form-data");
const cors = require("cors");

const app = express();
app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  })
);
app.use(express.json());

const BASE_URL = "https://api.pageindex.ai";

let DOC_ID = null;

// ==========================
// 1. Upload PDF → get doc_id
// ==========================
async function uploadPDF() {
  try {
    console.log("📄 Uploading PDF...");

    const form = new FormData();
    form.append("file", fs.createReadStream("./sample.pdf"));

    const res = await axios.post(
      `${BASE_URL}/doc`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          api_key: process.env.PAGEINDEX_API_KEY,
        },
      }
    );
    
    DOC_ID = res.data.doc_id;
    fs.writeFileSync("doc.json", JSON.stringify({ doc_id: DOC_ID }));
    console.log("✅ DOC_ID:", DOC_ID);
  } catch (err) {
    console.error("❌ Upload error:", err.response?.data || err.message);
  }
}

function loadDocId() {
  if (fs.existsSync("doc.json")) {
    const data = JSON.parse(fs.readFileSync("doc.json"));
    return data.doc_id;
  }
  return null;
}

// ==========================
// 2. Get context from PageIndex
// ==========================
async function getContext(query) {
      console.log("📄 getting context from pageindex")
  const res = await axios.post(
    `${BASE_URL}/chat/completions`,
    {
      doc_id: DOC_ID,
      messages: [
        {
          role: "user",
          content: `Extract ONLY relevant context for this query:\n\n${query}`,
        },
      ],
    },
    {
      headers: {
        api_key: process.env.PAGEINDEX_API_KEY,
        "Content-Type": "application/json",
      },
    }
  );
  console.log("📄 Retrieved context from PageIndex", res.data,res.data.choices[0].message.content);
  const content =
    res.data.choices[0].message.content;

  return content;
}

// ==========================
// 3. LLM Answer Generation
// ==========================
async function generateAnswer(query, context) {
    console.log("🤖 Generating answer with LLM...");
  try {
    const res = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openai/gpt-4o-mini", // or any model you choose

        messages: [
          {
            role: "system",
            content: `
You are a strict document-based AI assistant.

Rules:
- Answer ONLY using provided context
- Do NOT hallucinate
- If answer is not found, say "Not found in document"
- Keep answer concise
            `,
          },
          {
            role: "user",
            content: `
Context:
${context}

Question:
${query}
            `,
          },
        ],

        temperature: 0.2,
        max_tokens: 500,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          // REQUIRED by OpenRouter
          "HTTP-Referer": "http://localhost:3000",
          "X-Title": "PageIndex RAG Demo",
        },
      }
    );

    console.log("🤖 LLM Response:", res);
    return res.data.choices[0].message.content.trim();
  } catch (err) {
    console.error("❌ OpenRouter Error:", err.response?.data || err.message);
    return "Error generating answer";
  }
}

// ==========================
// 4. API Endpoint
// ==========================
app.post("/ask", async (req, res) => {
  try {
    const { query } = req.body;

    if (!DOC_ID) {
      return res.status(500).json({ error: "Doc not ready" });
    }
    // Step 1: Retrieve context
    const context = await getContext(query);
    // Step 2: Generate final answer via LLM
    const answer = await generateAnswer(query, context);

    res.json({
      answer,
      context, // useful for UI/debug
    });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).send("Error");
  }
});

// ==========================
// Start Server
// ==========================
async function init() {
  const savedDocId = loadDocId();

  if (savedDocId) {
    console.log("✅ Using existing doc_id:", savedDocId);
    DOC_ID = savedDocId;
    return;
  }

  // otherwise upload
  await uploadPDF();
}


app.listen(3000, async () => {
  console.log("🚀 Server running on http://localhost:3000");
  await init();
});