@echo off
echo 🚀 Installing Tablet Tracking Dependencies...

REM Install client dependencies
echo 📱 Installing client dependencies...
cd Ads2Go-Client
call npm install leaflet react-leaflet @types/leaflet

REM Install server dependencies (without OSRM)
echo 🖥️ Installing server dependencies...
cd ..\Ads2Go-Server
call npm install node-geocoder

echo ✅ Dependencies installed successfully!
echo.
echo 📋 Next steps:
echo 1. Start the server: cd Ads2Go-Server ^&^& npm start
echo 2. Start the client: cd Ads2Go-Client ^&^& npm start
echo 3. Access the tracking dashboard at: http://localhost:3000/admin/tablet-tracking
echo.
echo 🔧 Note: OSRM routing features have been replaced with simplified distance calculations
echo    for better compatibility across different platforms.
pause
