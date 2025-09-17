# Troubleshooting Location Tracking Errors

## Common Error: "Failed to update location tracking: Internal server error"

This error typically occurs when the AndroidPlayerExpo app cannot communicate with the backend server. Here's how to diagnose and fix it:

### 🔍 **Step 1: Check Backend Server Status**

**1.1 Verify Server is Running:**
```bash
cd Ads2Go-Server
npm start
```

**1.2 Check Server Logs:**
Look for any error messages in the server console. The server should show:
```
Server running on port 5000
MongoDB connected successfully
```

**1.3 Test Server Health:**
Open browser and go to: `http://192.168.100.22:5000/tablet/health`
You should see:
```json
{
  "success": true,
  "message": "Server is healthy and accessible",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "status": "OK"
}
```

### 🔍 **Step 2: Check Network Configuration**

**2.1 Verify IP Address:**
- The app uses `http://192.168.100.22:5000` as the API base URL
- Make sure this matches your computer's IP address
- Find your IP: `ipconfig` (Windows) or `ifconfig` (Mac/Linux)

**2.2 Update API URL if needed:**
Edit `androidPlayerExpo/services/tabletRegistration.ts`:
```typescript
const API_BASE_URL = 'http://YOUR_IP_ADDRESS:5000';
```

**2.3 Test Network Connectivity:**
- Ensure device/emulator can reach the server
- Try accessing the health endpoint from device browser
- Check firewall settings

### 🔍 **Step 3: Check Database Connection**

**3.1 Verify MongoDB:**
```bash
# Check if MongoDB is running
mongod --version

# Check if database is accessible
mongo
```

**3.2 Check Database Models:**
Ensure the `ScreenTracking` model is properly defined and accessible.

### 🔍 **Step 4: Check Tablet Registration**

**4.1 Verify Registration:**
- Make sure the tablet is properly registered
- Check that `ScreenTracking` record was created during registration
- Look for registration success message in logs

**4.2 Check Registration Data:**
The app should have valid registration data:
```typescript
{
  deviceId: "TABLET-UNIQUE-ID",
  materialId: "MATERIAL-ID",
  slotNumber: 1,
  carGroupId: "GRP-XXXXX",
  isRegistered: true
}
```

### 🔍 **Step 5: Check Location Permissions**

**5.1 Grant Location Permissions:**
- Android: Settings → Apps → AndroidPlayerExpo → Permissions → Location
- iOS: Settings → Privacy → Location Services → AndroidPlayerExpo

**5.2 Enable GPS:**
- Make sure GPS/Location Services are enabled
- Try in a location with good GPS signal

### 🔍 **Step 6: Debug with Enhanced Logging**

The app now includes enhanced error logging. Check the console for:

**6.1 Server Accessibility:**
```
Checking server accessibility at: http://192.168.100.22:5000
Server is accessible
```

**6.2 Location Updates:**
```
Updating location tracking: { deviceId: "...", lat: 14.5995, lng: 120.9842, speed: 25, heading: 45, accuracy: 5 }
API URL: http://192.168.100.22:5000/screenTracking/updateLocation
Response status: 200
Location tracking updated successfully
```

**6.3 Error Details:**
```
Error updating location tracking: [Error details]
HTTP Error: 500 Internal Server Error
Failed to update location tracking: Screen tracking record not found
```

### 🛠️ **Common Solutions**

**Solution 1: Restart Backend Server**
```bash
cd Ads2Go-Server
# Stop server (Ctrl+C)
npm start
```

**Solution 2: Clear App Data**
- Uninstall and reinstall the app
- Or clear app data in device settings

**Solution 3: Re-register Tablet**
- Use the "Re-register Tablet" button in the app
- This will create a fresh `ScreenTracking` record

**Solution 4: Check API Endpoints**
Verify these endpoints are working:
- `GET /tablet/health` - Server health check
- `POST /tablet/registerTablet` - Tablet registration
- `POST /screenTracking/updateLocation` - Location updates

**Solution 5: Network Issues**
- Use same WiFi network for device and server
- Check if corporate firewall is blocking connections
- Try using `localhost` for emulator testing

### 📱 **Testing Steps**

**1. Start Fresh:**
```bash
# Terminal 1: Start backend
cd Ads2Go-Server
npm start

# Terminal 2: Start app
cd androidPlayerExpo
npm start
```

**2. Register Tablet:**
- Open app on device/emulator
- Register with valid credentials
- Watch for "Continuous location tracking started successfully"

**3. Monitor Logs:**
- Check app console for location updates every 30 seconds
- Check server console for incoming API calls
- Verify no error messages

**4. Test Manual Controls:**
- Use "Stop Tracking" button
- Use "Start Tracking" button
- Verify status changes

### 🚨 **Emergency Debugging**

If nothing works, try this minimal test:

**1. Test Server Directly:**
```bash
curl -X GET http://192.168.100.22:5000/tablet/health
```

**2. Test Location Update Manually:**
```bash
curl -X POST http://192.168.100.22:5000/screenTracking/updateLocation \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "TEST-DEVICE",
    "lat": 14.5995,
    "lng": 120.9842,
    "speed": 0,
    "heading": 0,
    "accuracy": 5
  }'
```

**3. Check Database:**
```bash
mongo
use ads2go
db.screentrackings.find()
```

### 📞 **Still Having Issues?**

If the problem persists:

1. **Check all console logs** (both app and server)
2. **Verify network connectivity** between device and server
3. **Ensure all dependencies are installed** (`npm install` in both directories)
4. **Check MongoDB connection** and database state
5. **Try with a different device/emulator**

The enhanced error logging should now provide much more detailed information about what's failing. Look for specific error messages and follow the troubleshooting steps above.
