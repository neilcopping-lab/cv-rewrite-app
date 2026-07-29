// Voice answer transcription — same mechanism as the Interview Prep Report
// (OpenAI Whisper). Audio blob is transcribed then deleted from disk.
//
// Important: the browser upload is saved by multer WITHOUT a file extension,
// and OpenAI infers the audio format from the filename. So we wrap the stream
// with toFile() and give it a proper name/type derived from the upload, or
// OpenAI returns "Unrecognized file format".
const fs = require("fs");
const OpenAI = require("openai");
const { toFile } = require("openai");

// Map a browser mime type to a file extension OpenAI accepts.
function extFor(mimetype, originalname) {
  const m = (mimetype || "").toLowerCase();
  if (m.includes("mp4") || m.includes("m4a")) return "mp4";
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
  if (m.includes("ogg")) return "ogg";
  if (m.includes("wav")) return "wav";
  if (m.includes("webm")) return "webm";
  // fall back to the original filename's extension, else webm
  const dot = (originalname || "").lastIndexOf(".");
  if (dot > -1) return originalname.slice(dot + 1).toLowerCase();
  return "webm";
}

async function transcribe(filePath, originalname, mimetype) {
  if (!process.env.OPENAI_API_KEY) {
    fs.existsSync(filePath) && fs.unlinkSync(filePath);
    throw new Error("Voice transcription is not enabled. Please type your answer.");
  }
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  try {
    const ext = extFor(mimetype, originalname);
    const file = await toFile(fs.createReadStream(filePath), `answer.${ext}`, {
      type: mimetype || `audio/${ext}`
    });
    const res = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
      language: "en"
    });
    return res.text;
  } finally {
    try { fs.unlinkSync(filePath); } catch (_) {}
  }
}

module.exports = { transcribe };
