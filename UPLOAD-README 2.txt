THE COM'MON PEOPLE — CV REWRITE : DEPLOY BUNDLE
================================================
This zip contains everything that changed. To go live:

1. Extract this zip.
2. On github.com, open your cv-rewrite-app repo → Add file ▾ → Upload files.
3. Drag these into the upload area (from the extracted folder):
      - the  lib      folder
      - the  scripts  folder
      - the  public   folder
      - the file  server.js
      - the file  Dockerfile
4. Commit changes. Render will rebuild automatically.

DO NOT upload a "node_modules" or "data" folder (they are not in this zip).

Because the Dockerfile changed, Render does a FULL rebuild this time
(it installs WeasyPrint for the designer PDFs) — a few minutes longer.
When it's live, open /health and check "weasyprint":true.
