# Tablet Registration Flow

## Overview

The AndroidPlayerExpo app implements a complete tablet registration system that allows tablets to connect to the Ads2Go system through manual entry or QR code scanning.

## Flow Diagram

```
Tablet Boot → Check Registration → Not Registered → Show Manual Connect Screen
     ↓              ↓                    ↓                    ↓
  Registered    Auto Connect      Enter Details/Scan QR    Send to Backend
     ↓              ↓                    ↓                    ↓
  Show Main      Update Status      Validate Inputs      Update Database
     ↓              ↓                    ↓                    ↓
  Display Ads    Report GPS         Show Success/Error   Return Confirmation
```

## Features Implemented

### 1. **Registration Check on Startup**
- App checks local storage for existing registration
- If registered → auto-connect and show main screen
- If not registered → redirect to manual connect screen

### 2. **Manual Connection Screen**
- **Manual Entry**: Input fields for Material ID, Slot Number, Car Group ID
- **QR Code Scanning**: Camera-based QR code scanner
- **Validation**: Client-side validation of all inputs
- **Error Handling**: User-friendly error messages

### 3. **Backend API Endpoints**
- `POST /registerTablet` - Register a new tablet
- `POST /updateTabletStatus` - Update tablet online status and GPS
- `GET /tablet/:deviceId` - Get tablet information

### 4. **Main Screen Features**
- **Status Display**: Shows registration status, online status, and connection details
- **GPS Reporting**: Automatically reports location to backend
- **Re-registration**: Option to clear registration and start over
- **QR Code Display**: Shows this tablet's QR code for reference

## API Endpoints

### Register Tablet
```http
POST /registerTablet
Content-Type: application/json

{
  "deviceId": "TABLET-UNIQUE-ID",
  "materialId": "68b1f45b9384e0cec97f66aa",
  "slotNumber": 1,
  "carGroupId": "GRP-E522A5CC"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Tablet registered successfully",
  "tabletInfo": {
    "deviceId": "TABLET-UNIQUE-ID",
    "materialId": "68b1f45b9384e0cec97f66aa",
    "slotNumber": 1,
    "carGroupId": "GRP-E522A5CC",
    "status": "ONLINE",
    "lastReportedAt": "2024-01-15T10:30:00.000Z"
  },
  "adsList": []
}
```

### Update Tablet Status
```http
POST /updateTabletStatus
Content-Type: application/json

{
  "deviceId": "TABLET-UNIQUE-ID",
  "isOnline": true,
  "gps": {
    "lat": 14.5995,
    "lng": 120.9842
  }
}
```

### Get Tablet Info
```http
GET /tablet/TABLET-UNIQUE-ID
```

## Database Schema

### Tablet Model
```javascript
{
  materialId: String,          // Material's materialId field (e.g., "DGL-HEADDRESS-CAR-001")
  carGroupId: String,          // e.g., "GRP-E522A5CC"
  tablets: [
    {
      tabletNumber: Number,    // 1 or 2
      deviceId: String,        // Unique device identifier
      status: String,          // "ONLINE" or "OFFLINE"
      gps: {
        lat: Number,
        lng: Number
      },
      lastSeen: Date
    }
  ],
  createdAt: Date,
  updatedAt: Date
}
```

## Validation Rules

### Backend Validation
1. **Required Fields**: deviceId, materialId, slotNumber, carGroupId
2. **Slot Number**: Must be 1 or 2
3. **Material Type**: Must be HEADDRESS type
4. **Car Group ID**: Must match the tablet configuration
5. **Slot Availability**: Slot must not be occupied by another device

### Client Validation
1. **Material ID**: Non-empty string
2. **Slot Number**: Must be 1 or 2
3. **Car Group ID**: Non-empty string
4. **QR Code**: Must contain valid JSON with required fields

## Error Handling

### Common Error Scenarios
1. **Network Errors**: Retry mechanism with user feedback
2. **Invalid QR Code**: Clear error message and option to enter manually
3. **Slot Already Occupied**: Inform user about conflict
4. **Invalid Material**: Show appropriate error message
5. **Permission Denied**: Guide user to enable camera permissions

## Security Considerations

1. **Device ID Generation**: Uses device-specific information + timestamp
2. **Input Validation**: Both client and server-side validation
3. **CORS Configuration**: Proper CORS setup for API endpoints
4. **Error Messages**: Generic error messages to prevent information leakage

## Testing

### Manual Testing Steps
1. Start the AndroidPlayerExpo app
2. Verify it redirects to manual connect screen (first time)
3. Enter connection details manually
4. Verify successful registration
5. Restart app and verify auto-connection
6. Test QR code scanning functionality
7. Test re-registration flow

### API Testing
Run the test script:
```bash
cd Ads2Go-Server
node test-tablet-registration.js
```

## Future Enhancements

1. **Offline Support**: Queue registration attempts when offline
2. **Auto-Retry**: Automatic retry for failed registrations
3. **Push Notifications**: Notify admin when tablets connect/disconnect
4. **Analytics**: Track tablet usage and performance metrics
5. **Remote Configuration**: Allow admin to remotely configure tablets
