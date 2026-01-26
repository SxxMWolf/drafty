import express from "express";
import cors from "cors";

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
const MAX_DIGEST_OUTPUT_CHARS = 900;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const OPENAI_FALLBACK_MODEL =
  process.env.OPENAI_FALLBACK_MODEL || "gpt-4o-mini";

const OPENAI_TIMEOUT_MS = 10000;
const DRAFTY_API_URL = process.env.DRAFTY_API_URL || "";

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

async function callOpenAI(prompt, { model, maxTokens = 200 } = {}) {
  if (!OPENAI_API_KEY) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: model || OPENAI_MODEL,
        input: prompt,
        max_output_tokens: maxTokens
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const textOutput = data?.output?.[0]?.content?.[0]?.text;
    return typeof textOutput === "string" ? textOutput.trim() : null;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error(`[OpenAI] Timeout after ${OPENAI_TIMEOUT_MS}ms`);
    } else {
      console.error(`[OpenAI] Error: ${error.message}`);
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function callOpenAIWithFallback(prompt, { maxTokens = 200 } = {}) {
  const primary = await callOpenAI(prompt, { model: OPENAI_MODEL, maxTokens });
  if (primary) {
    return primary;
  }
  if (OPENAI_FALLBACK_MODEL && OPENAI_FALLBACK_MODEL !== OPENAI_MODEL) {
    return callOpenAI(prompt, { model: OPENAI_FALLBACK_MODEL, maxTokens });
  }
  return null;
}

async function callDraftyPolish({ text, tone, platform }) {
  if (!DRAFTY_API_URL) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

  try {
    const response = await fetch(DRAFTY_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, tone, platform }),
      signal: controller.signal
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const polishedText = data?.polishedText;
    return typeof polishedText === "string" ? polishedText.trim() : null;
  } catch (error) {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function buildMobilePolishPrompt({ text, tone, platform }) {
  return [
    "You are Drafty Polish for mobile.",
    "Rewrite the text to be smoother and clearer.",
    "Return ONLY the rewritten text.",
    "No markdown. No explanations. No preamble.",
    "Keep it concise and no longer than the input.",
    `Tone: ${tone}.`,
    `Platform: ${platform}.`,
    "Text:",
    text
  ].join("\n");
}

function buildMobilePolishPromptV2({ text, tone, platform }) {
  return [
    "You are Drafty Polish for mobile.",
    "Rewrite the text to be smoother and clearer.",
    "Return ONLY the rewritten text.",
    "No markdown. No explanations. No preamble.",
    "Keep it concise and no longer than the input.",
    `Tone: ${tone}.`,
    `Platform: ${platform}.`,
    "Text:",
    text
  ].join("\n");
}

function buildDigestPrompt({ text, tone, language }) {
  return [
    "You are Drafty Digest for desktop.",
    "Provide a brief summary followed by 3-5 bullet points covering the key details.",
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

app.post("/api/polish", async (req, res) => {
  const start = Date.now();
  const { text, type, tone, language } = req.body || {};
  const safeText = String(text ?? "").trim();

  console.log(`[POST /api/polish] Start - Mode: ${type}/${tone}, Length: ${safeText.length}`);

  try {
    const prompt = [
      "You are Drafty Rewrite for desktop.",
      "Rewrite the text to be smoother and clearer.",
      "Return ONLY the rewritten text.",
      "No markdown. No explanations. No preamble.",
      `Type: ${type || "community"}.`,
      `Tone: ${tone || "neutral"}.`,
      `Language: ${language || "auto"}.`,
      "Text:",
      safeText
    ].join("\n");

    const aiResult = await callOpenAIWithFallback(prompt, { maxTokens: 400 });
    const maxOutput = MAX_DESKTOP_OUTPUT_CHARS;
    const clamped = clampOutputLength(aiResult, maxOutput);

    const duration = Date.now() - start;
    if (clamped) {
      console.log(`[POST /api/polish] Success - Duration: ${duration}ms`);
      res.json({ result: clamped });
    } else {
      console.error(`[POST /api/polish] Failed - Duration: ${duration}ms - No Output`);
      res.json({ result: "Service busy, please try again." });
    }
  } catch (error) {
    const duration = Date.now() - start;
    console.error(`[POST /api/polish] Error - Duration: ${duration}ms`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


app.post("/api/digest", async (req, res) => {
  const start = Date.now();
  const { text, tone, language } = req.body || {};
  const safeText = String(text ?? "").trim();

  console.log(`[POST /api/digest] Start - Length: ${safeText.length}`);

  try {
    const prompt = buildDigestPrompt({
      text: safeText,
      tone: tone || "neutral",
      language: language || "auto"
    });

    const aiResult = await callOpenAIWithFallback(prompt, { maxTokens: 450 });
    const clamped = clampOutputLength(aiResult, MAX_DIGEST_OUTPUT_CHARS);

    const duration = Date.now() - start;
    if (clamped) {
      console.log(`[POST /api/digest] Success - Duration: ${duration}ms`);
      res.json({ result: clamped });
    } else {
      console.error(`[POST /api/digest] Failed - Duration: ${duration}ms - No Output`);
      res.json({ result: polishPlaceholder(safeText) });
    }
  } catch (error) {
    const duration = Date.now() - start;
    console.error(`[POST /api/digest] Error - Duration: ${duration}ms`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/polish", async (req, res) => {
  const start = Date.now();
  const { text = "", tone = "neutral", platform = "ios-keyboard" } = req.body || {};
  const safeText = String(text).slice(0, MAX_MOBILE_CHARS);

  console.log(`[POST /polish] Start - Platform: ${platform}, Length: ${safeText.length}`);

  try {
    const prompt = buildMobilePolishPrompt({ text: safeText, tone, platform });
    const draftyResult = await callDraftyPolish({ text: safeText, tone, platform });
    const aiResult = draftyResult || (await callOpenAIWithFallback(prompt, { maxTokens: 120 }));
    const maxOutput = MAX_MOBILE_OUTPUT_CHARS;
    const clamped = clampOutputLength(aiResult, maxOutput);

    const duration = Date.now() - start;
    if (clamped) {
      console.log(`[POST /polish] Success - Duration: ${duration}ms`);
      res.json({ polishedText: clamped });
    } else {
      console.error(`[POST /polish] Failed - Duration: ${duration}ms - No Output`);
      res.json({ polishedText: "Please try again." });
    }
  } catch (error) {
    const duration = Date.now() - start;
    console.error(`[POST /polish] Error - Duration: ${duration}ms`, error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const PORT = Number(process.env.PORT) || 8080;
app.listen(PORT, () => {
  console.log(`Rewrite server running on http://localhost:${PORT}`);
});
