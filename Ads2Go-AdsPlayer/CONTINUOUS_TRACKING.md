# Continuous Location Tracking - AndroidPlayerExpo

## Overview

The AndroidPlayerExpo app now supports **continuous location tracking** that sends GPS data, speed, heading, and other location information to the backend every 30 seconds.

## Features Implemented

### ✅ **Automatic Tracking**
- **Auto-start**: Tracking starts automatically after successful tablet registration
- **30-second intervals**: Location data sent every 30 seconds
- **10-meter threshold**: Also updates when device moves 10+ meters
- **High accuracy GPS**: Uses high-precision location services

### ✅ **Data Sent Continuously**
- **GPS Coordinates**: Latitude and longitude with high precision
- **Speed**: Current speed in km/h
- **Heading**: Direction of movement (0-360 degrees)
- **Accuracy**: GPS accuracy in meters
- **Address**: Reverse geocoded address from coordinates
- **Timestamp**: Exact time of each location update

### ✅ **UI Controls**
- **Status Display**: Shows tracking status (Active/Inactive)
- **Manual Controls**: Start/Stop tracking buttons
- **Real-time Feedback**: Status updates and error messages
- **Visual Indicators**: Green/red status indicators

### ✅ **Backend Integration**
- **Screen Tracking API**: Uses `/screenTracking/updateLocation` endpoint
- **Daily Sessions**: Automatic daily session management
- **Location History**: Complete GPS trail stored per day
- **Compliance Tracking**: 8-hour daily target monitoring
- **Alert System**: Speed violations and compliance alerts

## How It Works

### 1. **Registration Flow**
```
Tablet Registration → Auto-start Tracking → Continuous Data Sending
```

### 2. **Data Flow**
```
GPS Location → Process Data → Send to Backend → Store in Database
     ↓              ↓              ↓              ↓
Every 30s    Add Speed/Heading   API Call    Daily Session
```

### 3. **Backend Processing**
- Creates/updates daily session
- Stores location history
- Calculates distance traveled
- Monitors compliance (8-hour target)
- Generates alerts for violations

## Testing the Implementation

### 1. **Start the Backend Server**
```bash
cd Ads2Go-Server
npm start
```

### 2. **Start the AndroidPlayerExpo App**
```bash
cd androidPlayerExpo
npm start
```

### 3. **Register a Tablet**
1. Open the app on device/emulator
2. Register with valid Material ID, Slot Number, Car Group ID
3. **Tracking will start automatically** after successful registration

### 4. **Verify Continuous Tracking**
- Check the "Continuous Tracking" status card
- Status should show "Active - Sending data every 30 seconds"
- Green indicator should be visible
- Location updates should appear in console logs

### 5. **Monitor Backend Logs**
Watch the server console for incoming location updates:
```
Location updated: { latitude: 14.5995, longitude: 120.9842, speed: 25, heading: 45, accuracy: 5 }
Location tracking updated successfully
```

### 6. **Test Manual Controls**
- Use "Stop Tracking" button to pause
- Use "Start Tracking" button to resume
- Status should update accordingly

## API Endpoints Used

### **Location Update**
```http
POST /screenTracking/updateLocation
Content-Type: application/json

{
  "deviceId": "TABLET-UNIQUE-ID",
  "lat": 14.5995,
  "lng": 120.9842,
  "speed": 25,
  "heading": 45,
  "accuracy": 5
}
```

### **Get Tracking Status**
```http
GET /screenTracking/status/DEVICE-ID
```

### **Get Location History**
```http
GET /screenTracking/path/DEVICE-ID?date=2024-01-15
```

## Data Storage

### **Daily Sessions**
- Complete GPS trail stored per day
- Distance calculations
- Speed monitoring
- Compliance tracking

### **Location History**
- Every GPS point with timestamp
- Speed and heading data
- Address information
- Accuracy metrics

### **Performance Metrics**
- Total hours online
- Total distance traveled
- Compliance rates
- Average daily performance

## Troubleshooting

### **Tracking Not Starting**
1. Check location permissions are granted
2. Verify tablet is registered successfully
3. Check network connectivity
4. Review console logs for errors

### **No Data Being Sent**
1. Verify backend server is running
2. Check API endpoint URLs
3. Review network connectivity
4. Check device GPS is enabled

### **Permission Issues**
1. Grant location permissions when prompted
2. Enable GPS in device settings
3. Allow location access for the app

## Configuration

### **Update Intervals**
- **Time Interval**: 30 seconds (configurable in `tabletRegistration.ts`)
- **Distance Interval**: 10 meters (configurable)
- **GPS Accuracy**: High precision mode

### **API Configuration**
- **Base URL**: `http://192.168.100.22:5000` (update for your server)
- **Endpoint**: `/screenTracking/updateLocation`
- **Timeout**: Default fetch timeout

## Security & Privacy

- Location data is only sent to your configured backend server
- No third-party tracking services used
- Data is stored securely in your database
- Users can stop tracking at any time

## Performance Impact

- **Battery**: Moderate impact due to GPS usage
- **Data Usage**: ~1KB per location update
- **Network**: Minimal impact with 30-second intervals
- **Storage**: Efficient with MongoDB geospatial indexing
