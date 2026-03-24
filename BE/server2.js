require("dotenv").config();
const express = require("express");
const axios = require("axios");
const fs = require("fs");
const FormData = require("form-data");
const cors = require("cors");

// ✅ PageIndex SDK (correct)
const { PageIndexClient } = require("@pageindex/sdk");

const app = express();
app.use(
  cors({
    origin: true,
    methods: ["GET", "POST"],
    credentials: true,
  })
);
app.use(express.json());

const BASE_URL = "https://api.pageindex.ai";

let DOC_ID = null;
let TREE_READY = false;

// ✅ Init SDK client
const client = new PageIndexClient({
  apiKey: process.env.PAGEINDEX_API_KEY,
});

// ==========================
// 1. Upload PDF → get doc_id
// ==========================
async function uploadPDF() {
  try {
    console.log("📄 Uploading PDF...");

    const form = new FormData();
    form.append("file", fs.createReadStream("./sample.pdf"));

    const res = await axios.post(`${BASE_URL}/doc`, form, {
      headers: {
        ...form.getHeaders(),
        api_key: process.env.PAGEINDEX_API_KEY,
      },
    });

    DOC_ID = res.data.doc_id;
    fs.writeFileSync("doc.json", JSON.stringify({ doc_id: DOC_ID }));

    console.log("✅ DOC_ID:", DOC_ID);
  } catch (err) {
    console.error("❌ Upload error:", err.response?.data || err.message);
  }
}

function loadDocId() {
  if (fs.existsSync("doc.json")) {
    return JSON.parse(fs.readFileSync("doc.json")).doc_id;
  }
  return null;
}

// ==========================
// 🔥 2. INIT TREE (CACHE)
// ==========================
async function initTree() {
  if (TREE_READY) return;

  try {
    console.log("🌳 Building / Loading tree (first time slow)...");

    await client.api.getTree(DOC_ID);

    console.log("✅ Tree ready (cached)");
    TREE_READY = true;
  } catch (err) {
    console.error("❌ Tree init error:", err);
  }
}

// ==========================
// 🔥 3. FAST QUERY (CACHED)
// ==========================
async function getContext(query) {
  try {
    console.log("⚡ PageIndex fast query");

    const res = await client.api.chatCompletions({
      doc_id: DOC_ID,
      messages: [
        {
          role: "user",
          content: query,
        },
      ],
    });

    return res.choices[0].message.content;
  } catch (err) {
    console.error("❌ PageIndex Error:", err);
    return "";
  }
}

// ==========================
// 🔥 4. OpenRouter LLM
// ==========================
async function generateAnswer(query, context) {
  try {
    console.log("🤖 Generating answer (OpenRouter)");

    const res = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openai/gpt-4o-mini",

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
        max_tokens: 300,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "HTTP-Referer": "http://localhost:3000",
          "X-Title": "PageIndex Fast RAG Demo",
        },
      }
    );

    return res.data.choices[0].message.content.trim();
  } catch (err) {
    console.error("❌ OpenRouter Error:", err.response?.data || err.message);
    return "Error generating answer";
  }
}

// ==========================
// 🚀 5. API Endpoint
// ==========================
app.post("/ask", async (req, res) => {
  try {
    const { query } = req.body;

    if (!DOC_ID) {
      return res.status(500).json({ error: "Doc not ready" });
    }

    // ⚡ FAST (cached after first run)
    const context = await getContext(query);

    // 🤖 LLM (optional layer)
    const answer = await generateAnswer(query, context);

    res.json({
      answer,
      context,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error");
  }
});

// ==========================
// 🚀 INIT
// ==========================
async function init() {
  const savedDocId = loadDocId();

  if (savedDocId) {
    DOC_ID = savedDocId;
    console.log("✅ Using existing doc_id:", DOC_ID);
  } else {
    await uploadPDF();
  }

  // 🔥 CRITICAL STEP (tree caching)
  await initTree();
}

app.listen(3000, async () => {
  console.log("🚀 Server running on http://localhost:3000");
  await init();
});