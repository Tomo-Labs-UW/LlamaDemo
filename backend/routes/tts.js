import express from "express";

const router = express.Router();

const allowedVoices = (process.env.LEMONFOX_VOICES || "sarah")
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean);

router.get("/tts-voices", (_req, res) => {
  const voices = allowedVoices.map((id, index) => ({
    id,
    label: `Voice ${index + 1} - ${id}`,
  }));
  res.json(voices);
});

router.post("/tts", async (req, res) => {
  try {
    const { text, voice, language = "en-us" } = req.body || {};

    if (!text) {
      return res.status(400).json({ error: "Missing text" });
    }

    const apiKey = String(process.env.LEMONFOX_API_KEY || "").trim();
    if (!apiKey) {
      return res.status(500).json({ error: "Server misconfigured: missing LEMONFOX_API_KEY" });
    }

    const selectedVoice = allowedVoices.includes(voice)
      ? voice
      : process.env.LEMONFOX_DEFAULT_VOICE || "sarah";

    const response = await fetch("https://api.lemonfox.ai/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: text,
        voice: selectedVoice,
        language,
        response_format: "mp3",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error("Lemonfox error:", errorText);
      return res.status(response.status).json({
        error: "Lemonfox TTS failed",
        details: errorText,
      });
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.send(audioBuffer);
  } catch (err) {
    console.error("TTS route error:", err);
    res.status(500).json({ error: "Server error generating audio" });
  }
});

export default router;
