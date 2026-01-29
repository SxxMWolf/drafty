import express from "express";
import cors from "cors";
import { GoogleGenerativeAI } from "@google/generative-ai";

const app = express();
app.use(express.json());

// Full CORS for extension/content-script requests.
app.use(cors());

// Allow Private Network Access (HTTPS page -> localhost) in Chrome.
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Private-Network", "true");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});

const MAX_MOBILE_CHARS = 500;
const MAX_DESKTOP_OUTPUT_CHARS = 1200;
const MAX_MOBILE_OUTPUT_CHARS = 500;
const MAX_EXTRACT_OUTPUT_CHARS = 900;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = "gemini-flash-latest";

const DRAFTY_API_URL = process.env.DRAFTY_API_URL || "";

// Initialize Gemini
let genAI = null;
let model = null;

if (GEMINI_API_KEY) {
  try {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
  } catch (e) {
    console.error("[Gemini] Initialization failed:", e);
  }
}

function sanitizeOutput(text) {
  return String(text ?? "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function clampOutputLength(text, maxLength) {
  const safe = sanitizeOutput(text);
  if (!safe) {
    return "";
  }
  if (safe.length <= maxLength) {
    return safe;
  }

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

async function callGemini(prompt) {
  if (!model) {
    console.error("[Gemini] Model not initialized (missing API key?)");
    return null;
  }

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const textOutput = response.text();
    return typeof textOutput === "string" ? textOutput.trim() : null;
  } catch (error) {
    console.error(`[Gemini] Error: ${error.message}`);
    return null;
  }
}

async function callGeminiWithFallback(prompt) {
  // Simple wrapper for now, can add fallback logic later if needed
  return callGemini(prompt);
}

async function callDraftyEnhance({ text, tone, platform }) {
  if (!DRAFTY_API_URL) {
    return null;
  }
  const url = `${DRAFTY_API_URL}/enhance`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, tone, platform })
    });
    if (!response.ok) return null;
    const data = await response.json();
    const polishedText = data?.polishedText;
    return typeof polishedText === "string" ? polishedText.trim() : null;
  } catch (error) {
    return null;
  }
}

function buildMobileEnhancePrompt({ text, tone, platform }) {
  return [
    "You are Drafty Enhance for mobile.",
    "Rewrite the text to be smoother and clearer.",
    "Return ONLY the rewritten text.",
    "No markdown. No explanations. No preamble.",
    `Tone: ${tone}.`,
    `Platform: ${platform}.`,
    "Text:",
    text
  ].join("\n");
}



function buildExtractPrompt({ text, tone, language }) {
  return [
    "You are Drafty Extract for desktop.",
    "Provide a brief summary followed by bullet points covering the key details.",
    "Return ONLY the summary text.",
    "No markdown (except bullets). No explanations. No preamble.",
    "Use a clear bullet point format (e.g. •).",
    "Keep it concise and easy to skim.",
    `Tone: ${tone}.`,
    `Language: ${language}.`,
    "Text:",
    text
  ].join("\n");
}

function polishPlaceholder(text) {
  return String(text ?? "").replace(/\s+/g, " ").trim();
}

app.post("/api/enhance", async (req, res) => {
  const start = Date.now();
  const { text, type, tone, language } = req.body || {};
  const safeText = String(text ?? "").trim();

  console.log(`[POST /api/enhance] Start - Mode: ${type}/${tone}, Length: ${safeText.length}`);

  try {
    const prompt = [
      "You are Drafty Enhance for desktop.",
      "Rewrite the text to be smoother and clearer.",
      "Return ONLY the rewritten text.",
      "No markdown. No explanations. No preamble.",
      `Type: ${type || "community"}.`,
      `Tone: ${tone || "neutral"}.`,
      `Language: ${language || "auto"}.`,
      "Text:",
      safeText
    ].join("\n");

    const aiResult = await callGeminiWithFallback(prompt);
    const maxOutput = MAX_DESKTOP_OUTPUT_CHARS;
    const clamped = clampOutputLength(aiResult, maxOutput);

    const duration = Date.now() - start;
    if (clamped) {
      console.log(`[POST /api/enhance] Success - Duration: ${duration}ms`);
      res.json({ result: clamped });
    } else {
      console.error(`[POST /api/enhance] Failed - Duration: ${duration}ms - No Output`);
      res.json({ result: "Service busy, please try again." });
    }
  } catch (error) {
    const duration = Date.now() - start;
    console.error(`[POST /api/enhance] Error - Duration: ${duration}ms`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});




app.post("/api/extract", async (req, res) => {
  const start = Date.now();
  const { text, tone, language } = req.body || {};
  const safeText = String(text ?? "").trim();

  console.log(`[POST /api/extract] Start - Length: ${safeText.length}`);

  try {
    const prompt = buildExtractPrompt({
      text: safeText,
      tone: tone || "neutral",
      language: language || "auto"
    });

    const aiResult = await callGeminiWithFallback(prompt);
    const clamped = clampOutputLength(aiResult, MAX_EXTRACT_OUTPUT_CHARS);

    const duration = Date.now() - start;
    if (clamped) {
      console.log(`[POST /api/extract] Success - Duration: ${duration}ms`);
      res.json({ result: clamped });
    } else {
      console.error(`[POST /api/extract] Failed - Duration: ${duration}ms - No Output`);
      res.json({ result: polishPlaceholder(safeText) });
    }
  } catch (error) {
    const duration = Date.now() - start;
    console.error(`[POST /api/extract] Error - Duration: ${duration}ms`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/enhance", async (req, res) => {
  const start = Date.now();
  const { text = "", tone = "neutral", platform = "ios-keyboard" } = req.body || {};
  const safeText = String(text).slice(0, MAX_MOBILE_CHARS);

  console.log(`[POST /enhance] Start - Platform: ${platform}, Length: ${safeText.length}`);

  try {
    const prompt = buildMobileEnhancePrompt({ text: safeText, tone, platform });
    const draftyResult = await callDraftyEnhance({ text: safeText, tone, platform });
    const aiResult = draftyResult || (await callGeminiWithFallback(prompt));
    const maxOutput = MAX_MOBILE_OUTPUT_CHARS;
    const clamped = clampOutputLength(aiResult, maxOutput);

    const duration = Date.now() - start;
    if (clamped) {
      console.log(`[POST /enhance] Success - Duration: ${duration}ms`);
      res.json({ polishedText: clamped });
    } else {
      console.error(`[POST /enhance] Failed - Duration: ${duration}ms - No Output`);
      res.json({ polishedText: "Please try again." });
    }
  } catch (error) {
    const duration = Date.now() - start;
    console.error(`[POST /enhance] Error - Duration: ${duration}ms`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const PORT = Number(process.env.PORT) || 8080;
app.listen(PORT, () => {
  console.log(`Rewrite server running on http://localhost:${PORT}`);
});
