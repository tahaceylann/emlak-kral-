#!/usr/bin/env bash
# Emlak Kralı'nı tek komutla başlatır: sunucu (WebSocket, :8081) + istemci
# (statik dosya sunucusu, :8080) ayağa kalkar, tarayıcı otomatik açılır.
# macOS/Linux için. Windows'ta start.bat kullan.
set -e
cd "$(dirname "$0")"

PYTHON=python3
command -v python3 >/dev/null 2>&1 || PYTHON=python

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js bulunamadı. https://nodejs.org adresinden kurup tekrar dene." >&2
  exit 1
fi

echo "🏙️  Emlak Kralı başlatılıyor..."

if [ ! -d server/node_modules ]; then
  echo "→ Sunucu bağımlılıkları kuruluyor (yalnızca ilk çalıştırmada)..."
  (cd server && npm install --no-audit --no-fund)
fi

(cd server && node server.js) &
SERVER_PID=$!

(cd client && "$PYTHON" -m http.server 8080) &
CLIENT_PID=$!

cleanup() {
  echo ""
  echo "Kapatılıyor..."
  kill "$SERVER_PID" "$CLIENT_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

sleep 1
URL="http://localhost:8080"
echo "→ İstemci: $URL"
echo "→ Sunucu:  ws://localhost:8081"
if command -v open >/dev/null 2>&1; then
  open "$URL" 2>/dev/null || true
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$URL" 2>/dev/null || true
fi

echo ""
echo "Oyun çalışıyor. Kapatmak için bu pencerede Ctrl+C'ye bas."
wait
