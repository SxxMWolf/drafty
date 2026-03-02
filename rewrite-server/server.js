import express from "express";
import cors from "cors";
import OpenAI from "openai";
import { rateLimit } from "express-rate-limit";

const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "10kb" }));

/* =========================
   Environment Variables
========================= */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const API_KEY = process.env.API_KEY || "";

if (!OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY not found.");
  process.exit(1);
}

if (!API_KEY) {
  console.error("API_KEY not found.");
  process.exit(1);
}

/* =========================
   CORS (Allow All Origins)
========================= */

app.use(cors({
  origin: true,
  credentials: false
}));

/* =========================
   Rate Limiting
========================= */

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false
});

app.use("/api/", limiter);

/* =========================
   API Key Middleware
========================= */

function requireApiKey(req, res, next) {
  const key = req.headers["x-api-key"];

  if (!key || key !== API_KEY) {
    return res.status(403).json({ error: "Forbidden" });
  }

  next();
}

/* =========================
   Constants
========================= */

const MAX_INPUT_CHARS = 4000;
const MAX_DESKTOP_OUTPUT_CHARS = 1200;
const MAX_EXTRACT_OUTPUT_CHARS = 900;

/* =========================
   OpenAI Setup
========================= */

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY
});

/* =========================
   Utility Functions
========================= */

function sanitizeOutput(text) {
  return String(text ?? "")
    .replace(/```/g, "")
    .replace(/`/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function ensureParagraphs(text) {
  if (!text || text.length < 300 || text.includes("\n\n")) {
    return text;
  }

  if (text.includes("\n")) {
    return text.replace(/\n(?!\n)/g, "\n\n");
  }

  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];

  if (sentences.length > 3) {
    let result = "";
    for (let i = 0; i < sentences.length; i++) {
      result += sentences[i].trim();
      if ((i + 1) % 2 === 0 && i !== sentences.length - 1) {
        result += "\n\n";
      } else {
        result += " ";
      }
    }
    return result.trim();
  }

  return text;
}

function clampOutputLength(text, maxLength) {
  const safe = sanitizeOutput(text);
  if (!safe) return "";

  if (safe.length <= maxLength) return safe;

  const slice = safe.slice(0, maxLength).trim();
  const sentenceMatch = slice.match(/[\s\S]*[.!?]/);

  if (sentenceMatch && sentenceMatch[0].length >= Math.floor(maxLength * 0.6)) {
    return sentenceMatch[0].trim();
  }

  const lastSpace = slice.lastIndexOf(" ");
  if (lastSpace > 0) {
    return `${slice.slice(0, lastSpace).trim()}...`;
  }

  return `${slice}...`;
}

async function callOpenAI(messages, { temperature = 0.3, maxTokens = 800 } = {}) {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature,
      max_tokens: maxTokens,
      top_p: 1.0
    });

    const text = completion.choices[0]?.message?.content;
    return typeof text === "string" ? text.trim() : null;
  } catch (error) {
    console.error("[OpenAI Error]", error.message);
    return null;
  }
}

/* =========================
   API Routes
========================= */

app.post("/api/enhance", requireApiKey, async (req, res) => {
  const { text, type, tone, language } = req.body || {};

  const safeText = String(text ?? "")
    .slice(0, MAX_INPUT_CHARS)
    .trim();

  if (!safeText) {
    return res.status(400).json({ error: "Text is required" });
  }

  try {
    const messages = [
      {
        role: "system",
        content:
          "Improve the text to be smoother and clearer.\n" +
          "Use natural paragraph breaks.\n" +
          "Return only the improved text.\n" +
          "Adjust the tone based on the provided instruction."
      },
      {
        role: "user",
        content:
          `Type: ${type || "community"}\n` +
          `Tone: ${tone || "neutral"}\n` +
          `Language: ${language || "auto"}\n` +
          `Text:\n${safeText}`
      }
    ];

    const aiResult = await callOpenAI(messages);

    if (!aiResult) {
      return res.status(503).json({ error: "Service unavailable" });
    }

    const formatted = ensureParagraphs(aiResult);
    const clamped = clampOutputLength(
      formatted,
      MAX_DESKTOP_OUTPUT_CHARS
    );

    return res.json({ result: clamped });
  } catch (error) {
    console.error("Enhance Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/api/extract", requireApiKey, async (req, res) => {
  const { text, tone, language } = req.body || {};

  const safeText = String(text ?? "")
    .slice(0, MAX_INPUT_CHARS)
    .trim();

  if (!safeText) {
    return res.status(400).json({ error: "Text is required" });
  }

  try {
    const messages = [
      {
        role: "system",
        content:
          "Summarize the text.\n" +
          "First line: one-sentence overview.\n" +
          "Then bullet points with key facts.\n" +
          "Bullet symbol must be •\n" +
          "Return only the summary."
      },
      {
        role: "user",
        content:
          `Tone: ${tone || "neutral"}\n` +
          `Language: ${language || "auto"}\n` +
          `Text:\n${safeText}`
      }
    ];

    const aiResult = await callOpenAI(messages);

    if (!aiResult) {
      return res.status(503).json({ error: "Service unavailable" });
    }

    const clamped = clampOutputLength(
      aiResult,
      MAX_EXTRACT_OUTPUT_CHARS
    );

    return res.json({ result: clamped });
  } catch (error) {
    console.error("Extract Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

/* =========================
   Server Start
========================= */

const PORT = Number(process.env.PORT) || 8080;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});