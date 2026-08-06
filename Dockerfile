# The Com'mon People — CV Rewrite. Docker image so LibreOffice (PDF export)
# is available on Render's container runtime.
FROM node:18-bookworm-slim

# HOME must be writable for LibreOffice's first-run profile.
ENV NODE_ENV=production HOME=/tmp PORT=3000

# LibreOffice Writer (headless) for docx -> PDF, plus WeasyPrint (Python) for the
# HTML "designer" templates -> PDF. fonts-liberation / fonts-dejavu cover the
# body/serif fonts and the icon + bullet glyphs the designer templates use.
RUN apt-get update && apt-get install -y --no-install-recommends \
      libreoffice-writer-nogui \
      libreoffice-core-nogui \
      weasyprint \
      python3 \
      python3-pip \
      fonts-liberation \
      fonts-dejavu-core \
      ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Watermark deps for the preview PDF. Non-fatal: if the install fails for any
# reason, the build still succeeds and the watermark simply no-ops (fails open),
# so a dependency hiccup can never block a deploy.
RUN pip3 install --no-cache-dir --break-system-packages pypdf reportlab \
 || pip3 install --no-cache-dir pypdf reportlab \
 || ( apt-get update && apt-get install -y --no-install-recommends python3-pypdf python3-reportlab ) \
 || echo "watermark deps unavailable - preview watermark will no-op"

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY . .

EXPOSE 3000
CMD ["node", "server.js"]
