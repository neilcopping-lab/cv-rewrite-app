// PDF export rides on the docx (Section 12): rather than a second rendering
// pipeline, we convert the generated .docx straight to PDF. Uses LibreOffice
// headless via libreoffice-convert. On Render, add the LibreOffice buildpack
// (or apt: libreoffice-writer). Falls back with a clear error if unavailable.
let libre;
try { libre = require("libreoffice-convert"); } catch (_) { libre = null; }

function docxToPdf(docxBuffer) {
  if (!libre) return Promise.reject(new Error("libreoffice-convert not installed"));
  return new Promise((resolve, reject) => {
    libre.convert(docxBuffer, ".pdf", undefined, (err, done) => {
      if (err) reject(err);
      else resolve(done);
    });
  });
}

// Is a working soffice binary present? Used by /health and render tests.
function libreAvailable() {
  const { execSync } = require("child_process");
  try { execSync("which soffice || which libreoffice", { stdio: "ignore" }); return true; }
  catch (_) { return false; }
}

module.exports = { docxToPdf, libreAvailable };
