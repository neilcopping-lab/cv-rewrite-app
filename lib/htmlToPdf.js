// ─── HTML → PDF via weasyprint ──────────────────────────────────────────────
// The "designer" templates (lib/htmlDesigner.js) are real HTML/CSS, so we
// render them with weasyprint (installed in the Docker image; see Dockerfile).
// Node shells out to scripts/render_pdf.py: HTML in on stdin, PDF out on stdout.
const { spawn, execSync } = require("child_process");
const path = require("path");

const PY = process.env.PYTHON_BIN || "python3";
const SCRIPT = path.join(__dirname, "..", "scripts", "render_pdf.py");

function renderPdf(html) {
  return new Promise((resolve, reject) => {
    let p;
    try { p = spawn(PY, [SCRIPT]); }
    catch (e) { return reject(new Error("Could not start the PDF renderer: " + e.message)); }
    const out = [], err = [];
    p.on("error", (e) => reject(new Error("PDF renderer not available: " + e.message)));
    p.stdout.on("data", (d) => out.push(d));
    p.stderr.on("data", (d) => err.push(d));
    p.on("close", (code) => {
      const buf = Buffer.concat(out);
      if (code === 0 && buf.length) return resolve(buf);
      reject(new Error("PDF render failed" + (err.length ? ": " + Buffer.concat(err).toString().slice(0, 600) : "")));
    });
    p.stdin.on("error", () => {}); // ignore EPIPE if the child died early
    p.stdin.write(html);
    p.stdin.end();
  });
}

// Is weasyprint importable? Used by /health and to decide fallbacks.
function available() {
  try { execSync(`${PY} -c "import weasyprint"`, { stdio: "ignore" }); return true; }
  catch (_) { return false; }
}

module.exports = { renderPdf, available };
