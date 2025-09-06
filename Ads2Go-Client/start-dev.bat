@echo off
echo 🚀 Starting Ads2Go Client Development Server
echo ============================================

echo.
echo 📊 System Memory Check:
node check-memory.js

echo.
echo 🔧 Available Start Options:
echo 1. npm start              - 8GB heap (recommended)
echo 2. npm run start:fallback - 4GB heap (medium)
echo 3. npm run start:minimal  - 2GB heap (low memory)
echo.

set /p choice="Choose option (1-3): "

if "%choice%"=="1" (
    echo Starting with 8GB heap...
    npm start
) else if "%choice%"=="2" (
    echo Starting with 4GB heap...
    npm run start:fallback
) else if "%choice%"=="3" (
    echo Starting with 2GB heap...
    npm run start:minimal
) else (
    echo Invalid choice. Starting with default...
    npm start
)

pause
