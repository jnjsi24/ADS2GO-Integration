cd@echo off
echo 🚀 Installing All Dependencies for ADS2GO Integration...

echo.
echo 📱 Installing Client Dependencies...
cd Ads2Go-Client
call npm install

echo.
echo 🖥️ Installing Server Dependencies...
cd ..\Ads2Go-Server
call npm install

echo.
echo 📦 Installing Additional Tracking Dependencies...
call npm install node-geocoder

echo.
echo ✅ All Dependencies Installed Successfully!
echo.
echo 📋 Next Steps:
echo 1. Start the server: cd Ads2Go-Server ^&^& npm start
echo 2. Start the client: cd Ads2Go-Client ^&^& npm start
echo 3. Access the tracking dashboard at: http://localhost:3000/admin/tablet-tracking
echo.
echo 🔧 Note: All required packages including React Router, Firebase, Lucide React, etc. have been installed.
pause
