@echo off
echo ========================================
echo   SUPER BULMACA - Yerel Sunucu
echo ========================================
echo.
echo Sunucu baslatiliyor...
echo.
echo Tarayici otomatik olarak acilacak.
echo Sunucuyu durdurmak icin bu pencereyi kapatin.
echo.

REM Tarayıcıyı aç (2 saniye sonra)
start "" timeout /t 2 /nobreak >nul && start http://localhost:8000

REM Python HTTP sunucusunu başlat
python -m http.server 8000

pause
