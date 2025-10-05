# Tablet Unregister - Auto Redirect Fix

## Problem
When an admin unregistered a tablet from the dashboard, the tablet app (running on Expo Go) did not automatically return to the registration page. Users had to manually restart the Expo Go app.

## Solution
Implemented a real-time WebSocket notification system that automatically redirects the tablet to the registration page when it's unregistered by an admin.

## Changes Made

### Server-Side Changes

#### 1. `/Ads2Go-Server/src/resolvers/tabletResolver.js`
- Added WebSocket notification when admin unregisters a tablet
- Sends an 'unregister' message to the specific device before clearing its registration
- Located in the `unregisterTablet` mutation (around line 420-431)

```javascript
// Send WebSocket message to notify tablet it has been unregistered
try {
  const deviceStatusService = require('../services/deviceStatusService');
  console.log(`📤 Sending unregister notification to device: ${oldDeviceId}`);
  deviceStatusService.sendUnregisterNotification(oldDeviceId);
} catch (wsError) {
  console.error('Error sending unregister notification via WebSocket:', wsError);
  // Don't fail the unregister if WebSocket notification fails
}
```

#### 2. `/Ads2Go-Server/src/services/deviceStatusService.js`
- Added `sendUnregisterNotification(deviceId)` method (line 844-873)
- Sends a WebSocket message to the specific device
- Automatically closes the connection after 1 second to ensure message delivery

```javascript
sendUnregisterNotification(deviceId) {
  // Finds active WebSocket connection
  // Sends 'unregister' type message
  // Closes connection gracefully
}
```

### Client-Side Changes

#### 1. `/Ads2Go-AdsPlayer/services/deviceStatusService.js`
- Updated WebSocket message handler to listen for 'unregister' messages (line 245-283)
- When unregister message is received:
  - Clears local registration data
  - Closes WebSocket connection
  - Navigates to registration screen with `force=true` parameter

```javascript
else if (message.type === 'unregister') {
  // Clear registration
  await tabletRegistrationService.clearRegistration();
  // Navigate to registration screen
  router.replace('/registration?force=true');
}
```

#### 2. `/Ads2Go-AdsPlayer/contexts/DeviceStatusContext.tsx`
- Added `unregistered` flag to DeviceStatus type (line 11)
- Updated status change handler to detect unregistration (line 156-163)
- Triggers automatic navigation to registration screen
- Also added fallback navigation in periodic check (line 96-98)

## How It Works

### Flow Diagram
```
Admin Dashboard                 Server                    Tablet App
      |                           |                           |
      |-- unregisterTablet() ---->|                           |
      |                           |                           |
      |                           |-- WebSocket: unregister ->|
      |                           |   { type: 'unregister' }  |
      |                           |                           |
      |                           |                           |-- Receives message
      |                           |                           |-- Clears registration
      |                           |                           |-- Closes WebSocket
      |                           |                           |-- Navigates to /registration
      |                           |                           |
      |<-- Success response ------|                           |
      |                           |                           V
      |                           |                    Registration Screen
```

### Fallback Mechanism
Even if the WebSocket notification fails, the app has a fallback polling mechanism:
- Every 2 seconds, the app checks with the server if it's still registered
- If the server returns that the device is no longer registered, it automatically navigates to the registration screen
- This is implemented in `DeviceStatusContext.tsx` (line 88-113)

## Testing Instructions

### Prerequisites
1. Server running at the configured API URL
2. Admin dashboard accessible
3. Tablet app running in Expo Go

### Test Steps

1. **Register a Tablet**
   - Open tablet app in Expo Go
   - Complete registration with material ID and slot number
   - Verify tablet shows as online in admin dashboard

2. **Test Real-Time Unregister (WebSocket)**
   - Keep tablet app open and visible
   - In admin dashboard, unregister the tablet
   - **Expected Result**: Within 1-2 seconds, the tablet app should automatically navigate to the registration screen
   - Check console logs for: `🚨 [WebSocket] Device unregistered by administrator`

3. **Test Fallback Mechanism (Polling)**
   - Register tablet again
   - Disconnect WiFi/network temporarily
   - In admin dashboard, unregister the tablet
   - Reconnect network on tablet
   - **Expected Result**: Within 2-3 seconds after reconnection, the tablet should navigate to the registration screen

4. **Verify Registration Screen**
   - Check that the registration screen shows with `force=true` parameter
   - All previous registration data should be cleared
   - User can register the tablet again

### Success Criteria
- ✅ Tablet automatically returns to registration screen when unregistered (no manual restart needed)
- ✅ WebSocket notification is sent from server
- ✅ Client receives and processes unregister message
- ✅ Registration data is cleared properly
- ✅ Fallback polling mechanism works when WebSocket fails

## Benefits

1. **Improved User Experience**: No manual restart required
2. **Real-Time Updates**: Instant notification via WebSocket
3. **Reliability**: Fallback polling mechanism ensures functionality even if WebSocket fails
4. **Clean State Management**: Registration data is properly cleared
5. **Admin Control**: Admins can immediately revoke tablet access

## Notes

- The WebSocket connection is closed gracefully after 1 second to ensure the unregister message is delivered
- The client has multiple layers of detection (WebSocket + polling) for redundancy
- All changes are backward compatible and don't affect normal registration/unregistration flow
- Console logs are added for debugging and monitoring

