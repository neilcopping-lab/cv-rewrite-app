// Text extraction for CV + advert inputs. Files are deleted from disk the
// moment their text is pulled out - same data policy as the Interview Prep
// Report (uploaded files never linger on the server).
const fs = require("fs");
const path = require("path");
const mammoth = require("mammoth");

async function fromFile(filePath, mimetype, originalname = "") {
  const ext = (path.extname(originalname || filePath) || "").toLowerCase();
  try {
    if (ext === ".docx" || mimetype?.includes("word") || mimetype?.includes("officedocument")) {
      const { value } = await mammoth.extractRawText({ path: filePath });
      return clean(value);
    }
    if (ext === ".pdf" || mimetype === "application/pdf") {
      const pdfParse = require("pdf-parse");
      const buf = fs.readFileSync(filePath);
      const { text } = await pdfParse(buf);
      return clean(text);
    }
    // .txt / fallback
    return clean(fs.readFileSync(filePath, "utf8"));
  } finally {
    // Delete as soon as text is extracted - no retention.
    safeDelete(filePath);
  }
}

// Advert supplied as a URL - fetch and strip to readable text.
async function fromURL(url) {
  const fetch = global.fetch || require("node-fetch");
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 CommonPeopleCV" } });
  const html = await res.text();
  return clean(stripHtml(html));
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function clean(t) {
  return (t || "").replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function safeDelete(p) {
  try { fs.unlinkSync(p); } catch (_) {}
}

module.exports = { fromFile, fromURL, safeDelete };
