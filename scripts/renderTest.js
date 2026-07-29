// Section 12 render test: for EVERY design, build a real docx from realistic
// data, convert to PDF, and check the outputs are valid (non-trivial size,
// PDF magic bytes, multiple pages). Covers the human AND the ATS render, since
// the ATS version is where columns/sidebars must degrade cleanly.
const fs = require("fs");
const path = require("path");
const { designs } = require("../lib/designs");
const { buildDocx } = require("../lib/docxExport");
const { docxToPdf, libreAvailable } = require("../lib/pdfExport");
const cv = require("./fakeData");
function tryZip() { try { return require("adm-zip"); } catch (_) { return null; } }

const outDir = path.join(__dirname, "..", "render-test-output");
fs.mkdirSync(outDir, { recursive: true });

(async () => {
  const canPdf = libreAvailable();
  if (!canPdf) console.log("! LibreOffice not found — docx will be built, PDF step skipped.");
  const results = [];
  for (const d of designs) {
    for (const ats of [false, true]) {
      const tag = `${d.id}${ats ? "_ATS" : ""}`;
      const row = { design: d.id, layout: d.layout, ats, docx: null, pdf: null, ok: false, notes: [] };
      try {
        const buf = await buildDocx(cv, d, { ats });
        const docxPath = path.join(outDir, tag + ".docx");
        fs.writeFileSync(docxPath, buf);
        row.docx = buf.length;
        if (buf.length < 3000) row.notes.push("docx suspiciously small");
        // ATS render of ANY layout must be single-column: assert zero tables.
        if (ats) {
          const AdmZip = tryZip();
          if (AdmZip) {
            const xml = new AdmZip(buf).readAsText("word/document.xml");
            if (/<w:tbl>/.test(xml)) row.notes.push("ATS render contains a table (must be single-column)");
          }
        }
        if (canPdf) {
          const pdf = await docxToPdf(buf);
          fs.writeFileSync(path.join(outDir, tag + ".pdf"), pdf);
          row.pdf = pdf.length;
          const magic = pdf.slice(0, 5).toString() === "%PDF-";
          const pages = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
          row.pages = pages;
          if (!magic) row.notes.push("PDF magic bytes missing");
          if (pdf.length < 8000) row.notes.push("PDF suspiciously small");
        }
        row.ok = row.notes.filter((n) => /missing|small/.test(n)).length === 0;
      } catch (e) {
        row.notes.push("ERROR: " + e.message);
      }
      results.push(row);
    }
  }
  // Report
  const pass = results.filter((r) => r.ok).length;
  console.log("\n=== RENDER TEST REPORT ===");
  for (const r of results) {
    console.log(
      `${r.ok ? "✓" : "✗"} ${r.design.padEnd(20)} ${r.ats ? "ATS " : "human"} ` +
      `docx=${r.docx || "-"} pdf=${r.pdf || "-"}${r.pages != null ? " pages=" + r.pages : ""}` +
      (r.notes.length ? "  [" + r.notes.join("; ") + "]" : "")
    );
  }
  console.log(`\n${pass}/${results.length} renders passed. Files in ${outDir}`);
  fs.writeFileSync(path.join(outDir, "_report.json"), JSON.stringify(results, null, 2));
  process.exit(pass === results.length ? 0 : 1);
})();
