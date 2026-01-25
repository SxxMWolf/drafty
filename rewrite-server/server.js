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

function polishPlaceholder(text) {
  return String(text ?? "").replace(/\s+/g, " ").trim();
}

app.post("/api/rewrite", (req, res) => {
  const { text, type, tone, language } = req.body || {};

  res.json({
    result: `✨ REWRITTEN BY SERVER (${type}/${tone}/${language})\n\n${text ?? ""}`
  });
});

app.post("/polish", (req, res) => {
  const { text = "", tone = "neutral", platform = "ios-keyboard" } = req.body || {};
  const safeText = String(text).slice(0, MAX_MOBILE_CHARS);

  // Prompt is prepared for a future AI call.
  buildMobilePolishPrompt({ text: safeText, tone, platform });

  res.json({
    polishedText: polishPlaceholder(safeText)
  });
});

app.listen(8080, () => {
  console.log("Rewrite server running on http://localhost:8080");
});
