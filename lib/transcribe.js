// Voice answer transcription - same mechanism as the Interview Prep Report
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

// Captions for a practice video: only the SOUND of a take is sent (never the
// picture), with a time for every word so the captions keep in step. The file
// is deleted straight after, as above.
async function transcribeWords(filePath, originalname, mimetype) {
  if (process.env.MOCK_MODEL === "1") {
    try { fs.unlinkSync(filePath); } catch (_) {}
    const said = "Hi I'm Maya and I'd love to be your next trainee chef I work Saturdays at my uncle's cafe serving customers and cashing up";
    return said.split(" ").map((w, i) => ({ w, s: +(0.3 + i * 0.35).toFixed(2), e: +(0.6 + i * 0.35).toFixed(2) }));
  }
  if (!process.env.OPENAI_API_KEY) {
    try { fs.unlinkSync(filePath); } catch (_) {}
    throw new Error("Captions aren't available just now.");
  }
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  try {
    const ext = extFor(mimetype, originalname);
    const file = await toFile(fs.createReadStream(filePath), `take.${ext}`, { type: mimetype || `audio/${ext}` });
    const res = await openai.audio.transcriptions.create({
      file, model: "whisper-1", language: "en",
      response_format: "verbose_json", timestamp_granularities: ["word"],
    });
    return (res.words || []).slice(0, 900).map((x) => ({ w: String(x.word || "").trim(), s: Number(x.start) || 0, e: Number(x.end) || 0 })).filter((x) => x.w);
  } finally {
    try { fs.unlinkSync(filePath); } catch (_) {}
  }
}

module.exports.transcribeWords = transcribeWords;
