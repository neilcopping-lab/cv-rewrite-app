// Writes a realistic sample CV (.docx) and job advert (.txt) to /tmp for e2e.
const { Document, Packer, Paragraph, TextRun } = require("docx");
const fs = require("fs");
const P = (t, b = false) => new Paragraph({ children: [new TextRun({ text: t, bold: b })] });
const doc = new Document({ sections: [{ children: [
  P("Jordan Ellis", true), P("jordan.ellis@example.com | +44 7700 900123 | Manchester, UK"),
  P("Profile", true), P("Account manager of twelve years. I started running events for a family catering firm."),
  P("Experience", true),
  P("Senior Account Manager, Bright Northern Ltd, Manchester (2022 to now)", true),
  P("Lead a portfolio of 14 enterprise accounts across the UK and Ireland."),
  P("Grew portfolio revenue by £1.4m in two years. Built the QBR template now used company wide."),
  P("Account Manager, Halton Group, Leeds (2020 to 2022)", true),
  P("Managed 30 SME accounts and a junior coordinator. Cut churn from 18% to 9% by redesigning onboarding."),
  P("Skills", true), P("Enterprise account management. Salesforce, daily user since 2019, trained two cohorts. Inclusive hiring."),
  P("Education", true), P("BA History, University of Leeds, 2008 to 2011, 2:1. Salesforce Administrator certification, 2020."),
  P("Interests", true), P("Restoring a 1978 Vespa. Coaching under-11s football. Long distance trail running."),
] }] });
Packer.toBuffer(doc).then((b) => { fs.writeFileSync("/tmp/jordan_cv.docx", b); });
fs.writeFileSync("/tmp/advert.txt", "Senior Account Manager - Manchester\nWe are hiring a Senior Account Manager to own enterprise client relationships.\nRequirements: 5+ years managing enterprise client relationships. Working knowledge of Salesforce. Experience designing onboarding journeys. Fluent French for liaison with our Paris office.\n");
