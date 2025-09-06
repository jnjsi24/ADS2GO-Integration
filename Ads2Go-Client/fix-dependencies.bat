@echo off
echo 🔧 Fixing package dependencies and lock file...
echo ================================================

echo.
echo 📦 Removing node_modules and package-lock.json...
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del package-lock.json

echo.
echo 📥 Installing dependencies...
npm install

echo.
echo ✅ Dependencies fixed! You can now run:
echo    npm start
echo    or
echo    git add . && git commit -m "Fix dependencies" && git push

pause
