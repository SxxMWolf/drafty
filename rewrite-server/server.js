import express from "express";
import cors from "cors";
import OpenAI from "openai";
import { rateLimit } from "express-rate-limit";

const app = express();
app.use(express.json());

// Full CORS for extension/content-script requests.
app.use(cors());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { result: "Too many requests, please try again later." }
});

// Apply rate limiting to all /api and rewrite routes
app.use("/api/", limiter);
app.use("/enhance", limiter);

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

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
let openai = null;

if (OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: OPENAI_API_KEY,
  });
} else {
  console.warn("[OpenAI] Warning: OPENAI_API_KEY not found in environment.");
}

function sanitizeOutput(text) {
  return String(text ?? "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/**
 * Heuristic to ensure a long block of text has at least some paragraph breaks
 * if the AI failed to provide them despite instructions.
 */
function ensureParagraphs(text) {
  if (!text || text.length < 300 || text.includes("\n\n")) {
    return text;
  }

  // If it's a long block with only single newlines or no newlines,
  // try to convert single newlines to double newlines if they look like paragraph ends.
  if (text.includes("\n")) {
    return text.replace(/\n/g, "\n\n");
  }

  // If it's a giant single block with NO newlines, try to break after some sentences.
  // This is a fallback and might not be perfect, but better than a giant wall of text.
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

async function callOpenAI(messages, { temperature = 0.3, maxTokens = 800 } = {}) {
  if (!openai) {
    console.error("[OpenAI] Client not initialized (missing API key?)");
    return null;
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: messages,
      temperature: temperature,
      max_tokens: maxTokens,
      top_p: 1.0,
    });

    const text = completion.choices[0]?.message?.content;
    return typeof text === "string" ? text.trim() : null;
  } catch (error) {
    console.error(`[OpenAI] Error: ${error.message}`);
    return null;
  }
}



app.post("/api/enhance", async (req, res) => {
  const start = Date.now();
  const { text, type, tone, language } = req.body || {};
  const safeText = String(text ?? "").trim();

  console.log(`[POST /api/enhance] Start - Mode: ${type}/${tone}, Length: ${safeText.length}`);

  try {
    const messages = [
      {
        role: "system",
        content: [
          "You are Drafty Enhance for desktop.",
          "Rewrite the text to be smoother and clearer.",
          "CRITICAL: You MUST use natural paragraph breaks between semantic units (e.g., Greeting, Situation, Request, Schedule, Closing).",
          "ALWAYS use double newlines (\\n\\n) to separate paragraphs. Never return a single block of text for multiple ideas.",
          "Return ONLY the rewritten text.",
          "No markdown. No explanations. No preamble."
        ].join("\n")
      },
      {
        role: "user",
        content: [
          `Type: ${type || "community"}.`,
          `Tone: ${tone || "neutral"}.`,
          `Language: ${language || "auto"}.`,
          "Text:",
          safeText
        ].join("\n")
      }
    ];

    const aiResult = await callOpenAI(messages, { maxTokens: 800 });
    const formatted = ensureParagraphs(aiResult);
    const maxOutput = MAX_DESKTOP_OUTPUT_CHARS;
    const clamped = clampOutputLength(formatted, maxOutput);

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
    const messages = [
      {
        role: "system",
        content: [
          "You are Drafty Extract.",
          "Summarize the following text.",
          "First line: 1-sentence overview.",
          "Then: bullet points with key facts only.",
          "Do NOT add opinions.",
          "Do NOT repeat the text verbatim.",
          "Return ONLY the summary.",
          "Bullet symbol must be •"
        ].join("\n")
      },
      {
        role: "user",
        content: [
          `Tone: ${tone || "neutral"}.`,
          `Language: ${language || "auto"}.`,
          "Text:",
          safeText
        ].join("\n")
      }
    ];

    const aiResult = await callOpenAI(messages, { maxTokens: 800 });
    const clamped = clampOutputLength(aiResult, MAX_EXTRACT_OUTPUT_CHARS);

    const duration = Date.now() - start;
    if (clamped) {
      console.log(`[POST /api/extract] Success - Duration: ${duration}ms`);
      res.json({ result: clamped });
    } else {
      console.error(`[POST /api/extract] Failed - Duration: ${duration}ms - No Output`);
      res.json({ result: String(safeText ?? "").replace(/[ \t]+/g, " ").trim() });
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
    const messages = [
      {
        role: "system",
        content: [
          "You are Drafty Enhance for mobile.",
          "Rewrite the text to be smoother and clearer.",
          "CRITICAL: You MUST use natural paragraph breaks between semantic units (e.g., Greeting, Situation, Request, Schedule, Closing).",
          "ALWAYS use double newlines (\\n\\n) to separate paragraphs. Never return a single block of text for multiple ideas.",
          "Return ONLY the rewritten text.",
          "No markdown. No explanations. No preamble."
        ].join("\n")
      },
      {
        role: "user",
        content: [
          `Tone: ${tone}.`,
          `Platform: ${platform}.`,
          "Text:",
          safeText
        ].join("\n")
      }
    ];

    const aiResult = await callOpenAI(messages, { maxTokens: 500 });
    const formatted = ensureParagraphs(aiResult);
    const maxOutput = MAX_MOBILE_OUTPUT_CHARS;
    const clamped = clampOutputLength(formatted, maxOutput);

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
