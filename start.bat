@echo off
REM Emlak Krali'ni tek cift tikla baslatir: sunucu (WebSocket, :8081) ve
REM istemci (statik dosya sunucusu, :8080) ayri pencerelerde acilir,
REM tarayici otomatik acilir. macOS/Linux'ta start.sh kullan.
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js bulunamadi. https://nodejs.org adresinden kurup tekrar dene.
  pause
  exit /b 1
)

echo Emlak Krali baslatiliyor...

if not exist server\node_modules (
  echo Sunucu bagimliliklari kuruluyor ^(yalnizca ilk calistirmada^)...
  pushd server
  call npm install --no-audit --no-fund
  popd
)

start "Emlak Krali - Sunucu" cmd /k "cd /d %~dp0server && node server.js"
start "Emlak Krali - Istemci" cmd /k "cd /d %~dp0client && python -m http.server 8080"

timeout /t 2 /nobreak >nul
start "" "http://localhost:8080"

echo.
echo Iki pencere acildi (Sunucu + Istemci). Oyunu kapatmak icin ikisini de
echo kapatman yeterli. Bu pencereyi kapatabilirsin.
pause
