// Builds a clean, professional cover-letter Word document from the generated
// letter data. Converted to PDF (when requested) via the existing LibreOffice
// path, so a cover letter downloads as Word or PDF just like the CV.
const { Document, Packer, Paragraph, TextRun } = require("docx");

function P(text, o = {}) {
  return new Paragraph({
    spacing: { after: o.after == null ? 180 : o.after, line: 288 },
    alignment: o.align,
    children: [new TextRun({ text: text == null ? "" : String(text), bold: o.bold || false, italics: o.italics || false, size: o.size || 22, font: "Calibri", color: o.color || "1A1A1A" })]
  });
}

function buildCoverDocx(letter, cv) {
  const c = (cv.header && cv.header.contacts) || {};
  const contactLine = [c.email, c.phone, c.location].filter(Boolean).join("    ·    ");
  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  const kids = [];
  kids.push(P(cv.header && cv.header.name, { bold: true, size: 30, after: 24 }));
  if (contactLine) kids.push(P(contactLine, { size: 18, color: "6B6B6B", after: 220 }));
  kids.push(P(today, { size: 20, after: 200 }));
  kids.push(P(letter.greeting || "Dear Hiring Manager,", { after: 180 }));
  (letter.paragraphs || []).filter(Boolean).forEach((para) => kids.push(P(para, { after: 180 })));
  kids.push(P(letter.signOff || "Yours sincerely,", { after: 48 }));
  kids.push(P(letter.name || (cv.header && cv.header.name), { bold: true }));

  const doc = new Document({
    creator: (cv.header && cv.header.name) || "Cover Letter",
    title: "Cover Letter",
    styles: { default: { document: { run: { font: "Calibri", size: 22 } } } },
    sections: [{ properties: { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } }, children: kids }]
  });
  return Packer.toBuffer(doc);
}

module.exports = { buildCoverDocx };
