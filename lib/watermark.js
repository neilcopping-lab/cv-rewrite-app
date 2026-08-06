// Stamp a diagonal "PREVIEW" watermark on a PDF buffer (used for on-screen
// previews only, never the paid download). Spawns scripts/watermark_pdf.py.
// Fails open: if anything goes wrong, the original PDF is returned so the
// preview still shows.
const { spawn } = require("child_process");
const path = require("path");
const PY = process.env.PYTHON_BIN || "python3";
const SCRIPT = path.join(__dirname, "..", "scripts", "watermark_pdf.py");

function watermark(buf) {
  return new Promise((resolve) => {
    if (!Buffer.isBuffer(buf) || !buf.length) return resolve(buf);
    let p;
    try { p = spawn(PY, [SCRIPT]); }
    catch (_) { return resolve(buf); }
    const out = [];
    p.stdout.on("data", (d) => out.push(d));
    p.on("error", () => resolve(buf));
    p.on("close", (code) => {
      const res = Buffer.concat(out);
      resolve(code === 0 && res.length ? res : buf);
    });
    try { p.stdin.write(buf); p.stdin.end(); }
    catch (_) { resolve(buf); }
  });
}
module.exports = { watermark };
