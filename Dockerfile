# === Stage 1: Build frontend ===
FROM node:20-alpine AS client-build
WORKDIR /app/client
COPY client/package.json client/package-lock.json* ./
RUN npm install
COPY client/ ./
RUN npm run build

# === Stage 2: Build backend ===
FROM node:20-alpine AS server-build
WORKDIR /app
COPY server/package.json server/package-lock.json* ./
RUN npm install
COPY server/tsconfig.json ./
COPY server/src/ ./src/
RUN npx tsc
# Copy JSON data files that tsc doesn't include
RUN cp src/data/*.json dist/data/

# === Stage 3: Runtime ===
FROM node:20-alpine AS runtime
WORKDIR /app

COPY server/package.json server/package-lock.json* ./
RUN npm install --omit=dev

# Server compiled JS + data
COPY --from=server-build /app/dist ./dist

# Frontend built files → dist/client (Express serves from ../client relative to dist/)
COPY --from=client-build /app/client/dist ./client

# Directories for cache and replay downloads
RUN mkdir -p /app/cache /app/downloads

ENV PORT=3002
ENV DOWNLOAD_DIR=/app/downloads
ENV CACHE_TTL_MS=3600000

EXPOSE 3002

CMD ["node", "dist/index.js"]
