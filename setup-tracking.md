# Screen Tracking System Setup Guide

## Overview
This guide will help you set up the real-time screen tracking system with OSM and Leaflet integration for monitoring all screen types (HEADDRESS, LCD, Billboards), driver paths, and 8-hour daily compliance.

## Features Implemented

### ✅ **Real-time Tracking**
- GPS location updates every 30 seconds (for mobile screens)
- Automatic daily session management
- 8-hour daily driving compliance monitoring (for HEADDRESS)
- Distance calculation and route tracking
- Display metrics monitoring (for all screens)

### ✅ **OSM & Leaflet Integration**
- OpenStreetMap tiles for accurate mapping
- Real-time screen location markers
- Driver path visualization (for mobile screens)
- Interactive map with popup details
- Simplified distance calculations (no OSRM dependency)

### ✅ **Compliance Monitoring**
- Automatic 8-hour daily target tracking (for HEADDRESS)
- Real-time compliance status
- Alert system for low hours and violations
- Display issue alerts (for all screens)
- Historical compliance reporting

### ✅ **Admin Dashboard**
- Live map with all screen locations
- Real-time status monitoring
- Path history visualization
- Compliance reports and analytics
- Screen-specific metrics and alerts

## Installation Steps

### 1. **Install Dependencies**

```bash
# Run the comprehensive installation script (Recommended)
# For Windows:
install-all-deps.bat

# For Linux/Mac:
chmod +x install-all-deps.sh
./install-all-deps.sh

# Or install manually:
# In Ads2Go-Client directory
cd Ads2Go-Client
npm install

# In Ads2Go-Server directory
cd ../Ads2Go-Server
npm install
npm install node-geocoder
```

### 2. **Database Setup**

The system will automatically create the required collections when you start using it. No manual database setup is required.

### 3. **Start the Services**

```bash
# Start the backend server
cd Ads2Go-Server
npm start

# Start the client application
cd ../Ads2Go-Client
npm start
```

## API Endpoints

### **Screen Tracking Endpoints**

- `POST /screenTracking/updateLocation` - Update screen location
- `GET /screenTracking/status/:deviceId` - Get screen status
- `GET /screenTracking/path/:deviceId` - Get location history
- `GET /screenTracking/compliance` - Get compliance report
- `POST /screenTracking/startSession` - Start daily session
- `POST /screenTracking/endSession` - End daily session
- `POST /screenTracking/updateScreenMetrics` - Update display metrics
- `GET /screenTracking/screens` - Get all screens with filtering

### **Tablet Registration Endpoints**

- `POST /tablet/registerTablet` - Register new tablet
- `POST /tablet/updateTabletStatus` - Update tablet status
- `GET /tablet/tablet/:deviceId` - Get tablet info

### **Material Endpoints**

- `GET /material` - Get all materials
- `GET /material/:materialId` - Get specific material
- `GET /material/active` - Get only active materials

## Usage Guide

### **For AndroidPlayer (Tablet App)**

1. **Register Tablet**: Use the existing registration flow
2. **Enable Tracking**: The app will automatically start location tracking
3. **Monitor Status**: Check tracking status in the app

### **For Admin Dashboard**

1. **Access Tracking Page**: Navigate to `/admin/tablet-tracking`
2. **Select Material**: Use the dropdown to filter by specific materials
3. **View Live Map**: See all screens for the selected material in real-time
4. **Monitor Compliance**: Check 8-hour daily targets for filtered screens
5. **View Paths**: Click on screens to see their routes
6. **Material Summary**: View detailed information about the selected material

## Key Features

### **8-Hour Daily Compliance**
- Automatic session tracking from midnight to midnight
- Real-time hours calculation
- Compliance status updates
- Alert system for non-compliance

### **Real-time Location Tracking**
- GPS updates every 30 seconds
- Address reverse geocoding via OSM
- Speed and heading monitoring
- Distance calculation

### **Path Visualization**
- Historical route display
- Distance tracking
- Speed analysis
- Location clustering

### **Alert System**
- Low hours warnings (before 8-hour target)
- Speed violations (over 80 km/h)
- Offline detection
- Route deviation alerts

## Configuration

### **Location Update Frequency**
- Default: 30 seconds
- Configurable in `androidPlayerExpo/services/tabletRegistration.ts`

### **Compliance Target**
- Default: 8 hours per day
- Configurable in `Ads2Go-Server/src/models/screenTracking.js`

### **Alert Thresholds**
- Low hours: Less than 6 hours with 2+ hours remaining
- Speed violation: Over 80 km/h
- Configurable in `Ads2Go-Server/src/routes/screenTracking.js`

## Testing the System

### **1. Register a Tablet**
```bash
curl -X POST http://localhost:5000/tablet/registerTablet \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "TEST-TABLET-001",
    "materialId": "DGL-HEADDRESS-CAR-001",
    "slotNumber": 1,
    "carGroupId": "GRP-TEST123"
  }'
```

### **2. Update Location**
```bash
curl -X POST http://localhost:5000/screenTracking/updateLocation \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "TEST-TABLET-001",
    "lat": 14.5995,
    "lng": 120.9842,
    "speed": 25,
    "heading": 90,
    "accuracy": 10
  }'
```

### **3. Check Status**
```bash
curl http://localhost:5000/screenTracking/status/TEST-TABLET-001
```

## Troubleshooting

### **Map Not Loading**
- Check if Leaflet CSS is imported
- Verify internet connection for OSM tiles
- Check browser console for errors

### **Location Updates Not Working**
- Verify GPS permissions on tablet
- Check network connectivity
- Review server logs for errors

### **Compliance Not Calculating**
- Ensure daily sessions are starting correctly
- Check timezone settings
- Verify date calculations

## Next Steps

1. **Deploy to Production**: Update API URLs for production
2. **Add Authentication**: Secure tracking endpoints
3. **Optimize Performance**: Add caching and pagination
4. **Add Notifications**: Real-time alerts via email/SMS
5. **Export Reports**: CSV/PDF compliance reports

## Support

For issues or questions:
1. Check server logs for error messages
2. Verify database connections
3. Test API endpoints individually
4. Review configuration settings
