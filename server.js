import express from "express";
import cors from "cors";
import { Readable } from "stream";
import { finished } from "stream/promises";

const app = express();
app.set("etag", false);

app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:3000"],
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.static("."));
app.use("/api", (_req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
});

const OLLAMA_BASE_URL = "http://127.0.0.1:11434";
const OLLAMA_CHAT_URL = `${OLLAMA_BASE_URL}/api/chat`;
const OLLAMA_TAGS_URL = `${OLLAMA_BASE_URL}/api/tags`;
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3:latest";
const OLLAMA_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS || 120000);
const MAX_LENGTH_RETRIES = Number(process.env.MAX_LENGTH_RETRIES || 1);
const MAX_FORMAT_RETRIES = Number(process.env.MAX_FORMAT_RETRIES || 3);
const LONG_INPUT_WORDS = Number(process.env.LONG_INPUT_WORDS || 900);

function wordCount(str = "") {
  return (str.trim().match(/\S+/g) || []).length;
}

function buildSystemPrompt() {
  return `
Task:
Rewrite the given text in a simple, conversational way (like explaining it to a friend), making it easier to understand while preserving all important information.

Style rules:
- Use a warm, conversational voice throughout, as if chatting with a friend.
- Use casual signposting naturally (e.g., "Okay, so basically...", "In other words...", "Here's the key idea...").
- Expand explanations when useful so readers can follow the logic step-by-step.
- Keep important terms and keywords from the source text, and explain each in plain English the first time it appears.
- Do not add new claims. Do not change the meaning.
- Keep any key caveats or limitations.
- Avoid bullet points unless they are in the original text.
- Aim for clarity through explanation, not through omission.

Length requirement:
- The rewritten text should usually be similar in length to the original, or slightly longer to improve clarity.

Formatting:
- Output only the rewritten version.
- No headings, no bullets, no numbering unless they were in the original.
- Preserve paragraph spacing (blank line between paragraphs).
- Do NOT evaluate the writing, do NOT give feedback.
`.trim();
}

function buildRewriteUserPrompt(text) {
  return `
Rewrite the following text to make it easier to understand and more conversational.

Requirements:
- Rewrite in a friendly, conversational style
- Keep the same meaning and all important details
- Explain any technical terms in plain English
- Make it flow naturally like a conversation
- Do not add commentary or meta-text

TEXT TO REWRITE:
<<<BEGIN TEXT>>>
${text}
<<<END TEXT>>>
`.trim();
}

function looksLikeEvaluation(text = "") {
  return /(your rewritten text|you did well|great job|if i were to suggest|overall, your|i completely agree with you|here are some specific suggestions|by following these suggestions)/i.test(text);
}

function looksStructuredOrMarkdown(text = "") {
  return /(^|\n)\s*(\*\*[^*]+:\*\*|#{1,6}\s|[-*]\s+|\d+\.\s+|let me know if you have)/i.test(text);
}

function looksLikeAdviceMode(text = "") {
  return /(use simpler language|break up long sentences|use concrete examples|emphasize key points|we can make|can make it easier)/i.test(text);
}

function looksLikeMetaResponse(text = "") {
  return /(i'?d be happy to help|the original text appears|the rewritten version aims|here are some key points|some potential issues|to avoid these issues|what's next:|let me know if you have|if you'd like, i can help|just let me know)/i.test(
    text
  );
}

function looksLikeListOrHeadings(text = "") {
  return /(^|\n)\s*(\*\*[^*]+:\*\*|[-*]\s+|\d+\.\s+)/i.test(text);
}

function looksTooFigurative(text = "") {
  return /(imagine you('?| a)re|think of it like|kind of like|picture this|sounds harmless|at a party)/i.test(text);
}

function sanitizeRewrite(text = "") {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) =>
      line
        .replace(/^\s*#{1,6}\s+/, "")
        .replace(/^\s*\*\*[^*]+:\*\*\s*/, "")
        .replace(/^\s*[-*]\s+/, "")
        .replace(/^\s*\d+\.\s+/, "")
    )
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isValidRewrite(text = "") {
  if (!text || text.trim().length < 80) return false;
  if (looksLikeMetaResponse(text)) return false;
  if (looksLikeEvaluation(text)) return false;
  if (looksLikeAdviceMode(text)) return false;
  if (looksLikeListOrHeadings(text)) return false;
  if (looksTooFigurative(text)) return false;
  return true;
}

async function ollamaChat({ system, user, temperature = 0.2 }) {
  const inputWords = wordCount(user);
  const numPredict = Math.max(256, Math.min(2200, Math.ceil(inputWords * 1.3)));
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);
  let r;
  try {
    r = await fetch(OLLAMA_CHAT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        options: { temperature, top_p: 0.9, num_predict: numPredict },
      }),
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!r.ok) {
    const text = await r.text();
    throw new Error(`Ollama error ${r.status}: ${text}`);
  }

  const data = await r.json();
  return data?.message?.content ?? "";
}

async function getOllamaStatus() {
  try {
    const r = await fetch(OLLAMA_TAGS_URL);
    if (!r.ok) {
      return {
        backend: "ok",
        ollamaReachable: false,
        model: OLLAMA_MODEL,
        modelAvailable: false,
        details: `Ollama /api/tags returned ${r.status}`,
      };
    }

    const data = await r.json().catch(() => ({}));
    const models = Array.isArray(data.models) ? data.models : [];
    const modelNames = models.map((m) => m.name).filter(Boolean);
    const modelAvailable = modelNames.includes(OLLAMA_MODEL);

    return {
      backend: "ok",
      ollamaReachable: true,
      model: OLLAMA_MODEL,
      modelAvailable,
      modelCount: modelNames.length,
      details: modelAvailable ? "Model available." : "Model not found in local Ollama tags.",
    };
  } catch (error) {
    return {
      backend: "ok",
      ollamaReachable: false,
      model: OLLAMA_MODEL,
      modelAvailable: false,
      details: `Could not reach Ollama: ${error.message}`,
    };
  }
}

app.post("/api/tts", async (req, res) => {
  // simple proxy to the Lemonfox TTS API, streaming the resulting MP3 back to the client
  try {
    const text = (req.body?.text ?? "").trim();
    if (!text) return res.status(400).json({ error: "Missing text" });
    const voice = req.body?.voice || "sarah";
    const apiKey = process.env.LEMONFOX_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Server misconfigured: missing LEMONFOX_API_KEY" });
    }

    const ttsResponse = await fetch("https://api.lemonfox.ai/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: text,
        voice,
        response_format: "mp3",
      }),
    });

    if (!ttsResponse.ok) {
      const body = await ttsResponse.text().catch(() => "");
      return res.status(502).json({ error: "TTS provider error", details: body });
    }

    // pipe the mp3 bytes straight through to the express response
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Disposition", "attachment; filename=\"speech.mp3\"");
    await finished(Readable.fromWeb(ttsResponse.body).pipe(res));
    return;
  } catch (e) {
    return res.status(500).json({ error: "Server error", details: String(e) });
  }
});

app.post("/api/simplify", async (req, res) => {
  try {
    const text = (req.body?.text ?? "").trim();
    if (!text) return res.status(400).json({ error: "Missing text" });
    const inputWC = wordCount(text);

    const system = buildSystemPrompt();

    // 1st pass
    let simplified = await ollamaChat({
      system,
      user: buildRewriteUserPrompt(text),
      temperature: 0.1
    });

    // Length guardrail
    let outWC = wordCount(simplified);

    const minWC = Math.floor(inputWC * 1.1);
    const maxWC = Math.ceil(inputWC * 2.0);
    const fastMode = inputWC >= LONG_INPUT_WORDS;
    const lengthRetries = fastMode ? 0 : MAX_LENGTH_RETRIES;
    const formatRetries = fastMode ? 1 : MAX_FORMAT_RETRIES;

    // Hard length enforcement with retries so short/long drafts do not slip through.
    for (let attempt = 0; attempt < lengthRetries && (outWC < minWC || outWC > maxWC); attempt += 1) {
      const adjustInstruction = `
Your rewrite did not meet the length requirement.

Original word count: ${inputWC}
Your word count: ${outWC}
Target range: ${minWC}-${maxWC}

Fix it:
- Keep the SAME meaning and ALL details.
- No headings, no bullet points, no numbering.
- No new metaphors/analogies/examples.
- Adjust length to be within target range.
Return ONLY the corrected rewrite.
`.trim();

      simplified = await ollamaChat({
        system,
        user: `${adjustInstruction}

Rewrite the ORIGINAL TEXT again so it is in range.

ORIGINAL TEXT:
${text}

DRAFT REWRITE TO IMPROVE:
${simplified}`,
        temperature: 0.1, 
      });

      outWC = wordCount(simplified);
    }

    for (
      let attempt = 0;
      attempt < formatRetries &&
      (!isValidRewrite(simplified) || outWC < minWC || outWC > maxWC);
      attempt += 1
    ) {
      simplified = await ollamaChat({
        system,
        user: `Your previous output was invalid because it included meta commentary or list formatting.

Return ONLY the rewritten passage text.
No critique. No feedback. No "I'd be happy to help."
No headings. No bullet points. No numbered lists. No markdown.
Do not mention what the rewrite is doing; just do it.
Keep length between ${minWC} and ${maxWC} words.

ORIGINAL TEXT:
${text}

INVALID OUTPUT TO AVOID:
${simplified}`,
        temperature: 0.05
      });

      outWC = wordCount(simplified);
    }

    if (!isValidRewrite(simplified)) {
      const cleaned = sanitizeRewrite(simplified);
      const cleanedWC = wordCount(cleaned);
      const minimumUsableWC = Math.max(40, Math.floor(inputWC * 0.5));

      if (cleaned && cleanedWC >= minimumUsableWC) {
        simplified = cleaned;
        outWC = cleanedWC;
      } else {
        return res.status(502).json({
          error: "Model failed rewrite-format constraints after retries. Try again with a shorter passage.",
          debug: {
            sample: simplified.slice(0, 300),
            outputWordCount: outWC,
            targetRange: [minWC, maxWC],
          }
        });
      }
    }

    const lengthConstraintMet = outWC >= minWC && outWC <= maxWC;

    return res.json({
      simplified,
      warning: lengthConstraintMet
        ? undefined
        : "Rewrite succeeded but did not fully meet the target length range.",
      debug: {
        inputWordCount: inputWC,
        outputWordCount: outWC,
        targetRange: [minWC, maxWC],
        lengthConstraintMet,
        fastMode,
      },
    });
  } catch (e) {
    return res.status(500).json({ error: "Server error", details: String(e) });
  }
});

app.get("/health", async (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/status", async (_req, res) => {
  const status = await getOllamaStatus();
  res.json(status);
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Express API running on http://localhost:${PORT}`);
  console.log(`POST http://localhost:${PORT}/api/simplify`);
});
