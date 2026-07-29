// Voice answer transcription — same mechanism as the Interview Prep Report
// (OpenAI Whisper). Audio blob is transcribed then deleted from disk.
const fs = require("fs");
const OpenAI = require("openai");

async function transcribe(filePath) {
  if (!process.env.OPENAI_API_KEY) {
    fs.existsSync(filePath) && fs.unlinkSync(filePath);
    throw new Error("OPENAI_API_KEY not set");
  }
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  try {
    const res = await openai.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: "whisper-1",
      language: "en"
    });
    return res.text;
  } finally {
    try { fs.unlinkSync(filePath); } catch (_) {}
  }
}

module.exports = { transcribe };
