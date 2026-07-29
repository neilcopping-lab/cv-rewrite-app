# The Com'mon People — CV Rewrite. Docker image so LibreOffice (PDF export)
# is available on Render's container runtime.
FROM node:18-bookworm-slim

# HOME must be writable for LibreOffice's first-run profile.
ENV NODE_ENV=production HOME=/tmp PORT=3000

# LibreOffice Writer (headless) + core fonts for docx -> PDF conversion.
RUN apt-get update && apt-get install -y --no-install-recommends \
      libreoffice-writer-nogui \
      libreoffice-core-nogui \
      fonts-liberation \
      ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY . .

EXPOSE 3000
CMD ["node", "server.js"]
