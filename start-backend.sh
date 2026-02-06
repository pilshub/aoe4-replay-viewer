#!/bin/bash
set -e

echo "[startup] Starting .NET parser on port 5069..."
cd /app/parser
dotnet Aoe4WorldReplaysApi.dll &
PARSER_PID=$!

# Wait for parser to be healthy
echo "[startup] Waiting for parser to be ready..."
for i in $(seq 1 30); do
  if curl -sf http://localhost:5069/health > /dev/null 2>&1; then
    echo "[startup] Parser is ready!"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "[startup] ERROR: Parser failed to start after 30s"
    exit 1
  fi
  sleep 1
done

echo "[startup] Starting Node.js server on port ${PORT:-${SERVER_PORT:-3002}}..."
cd /app/server
exec node dist/index.js
