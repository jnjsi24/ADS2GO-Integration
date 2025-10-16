# Historical Data Analysis

## Summary of Data Being Saved to Historical Storage

Based on the code analysis, here's what data is being saved to historical storage:

### ✅ **QR Code Display Events** - SAVED TO HISTORICAL DATA
**Endpoint:** `/deviceTracking/qr-scan` (for QR display)
**Data Saved:**
- `deviceId` - Device identifier
- `deviceSlot` - Slot number
- `qrScanData` - Complete QR display data including:
  - `adId` - Advertisement ID
  - `adTitle` - Advertisement title
  - `materialId` - Material ID
  - `slotNumber` - Ad slot number
  - `timestamp` - When QR was displayed
  - `qrCodeUrl` - Generated tracking URL
  - `website` - Advertiser website
  - `deviceInfo` - Device details (deviceId, name, type, OS, brand, model)
  - `gpsData` - GPS coordinates (lat, lng, speed, heading, accuracy, altitude)
  - `registrationData` - Registration info
  - `networkStatus` - Online/offline status
  - `screenData` - Screen dimensions

### ✅ **QR Code Scan Events** - SAVED TO HISTORICAL DATA
**Endpoint:** `/ads/qr-scan` (for QR scans)
**Data Saved:**
- Same comprehensive data as QR display
- Additional scan-specific data
- User interaction tracking

### ✅ **Location Updates** - SAVED TO HISTORICAL DATA
**Endpoint:** `/deviceTracking/location-update`
**Data Saved:**
- `deviceId` - Device identifier
- `materialId` - Material ID
- `deviceSlot` - Slot number
- `carGroupId` - Car group ID
- `lat` - Latitude
- `lng` - Longitude
- `speed` - Current speed
- `heading` - Direction of travel
- `accuracy` - GPS accuracy

### ✅ **Ad Playback Analytics** - SAVED TO HISTORICAL DATA
**Endpoint:** `/deviceTracking/ad-playback` (via offline queue)
**Data Saved:**
- `deviceId` - Device identifier
- `deviceSlot` - Slot number
- `adId` - Advertisement ID
- `adTitle` - Advertisement title
- `adDuration` - Ad duration
- `viewTime` - Time viewed
- `completionRate` - Percentage completed
- `impressions` - Number of impressions
- `startTime` - When ad started
- `endTime` - When ad ended

## Data Flow Summary

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   QR Display    │───▶│  /deviceTracking │───▶│  Historical DB  │
│   (Real-time)   │    │     /qr-scan     │    │   (Driver Data) │
└─────────────────┘    └──────────────────┘    └─────────────────┘

┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   QR Scan       │───▶│    /ads/qr-scan  │───▶│  Historical DB  │
│   (User Action) │    │                  │    │   (Driver Data) │
└─────────────────┘    └──────────────────┘    └─────────────────┘

┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Location GPS   │───▶│ /deviceTracking  │───▶│  Historical DB  │
│  (Every 7s)     │    │ /location-update │    │   (Driver Data) │
└─────────────────┘    └──────────────────┘    └─────────────────┘

┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Ad Playback     │───▶│ /deviceTracking  │───▶│  Historical DB  │
│ Analytics       │    │  /ad-playback    │    │   (Driver Data) │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Driver Tracking Data Completeness

### ✅ **Complete Driver Profile Data**
Your system is saving comprehensive driver tracking data including:

1. **Location History** - Every 7 seconds with GPS coordinates, speed, heading
2. **QR Code Interactions** - Both display and scan events with full context
3. **Ad Engagement** - Playback analytics, completion rates, view times
4. **Device Information** - Device type, OS, registration details
5. **Temporal Data** - Timestamps for all events
6. **Contextual Data** - Material ID, slot number, car group ID

### 📊 **Data Categories for Logging**

Based on your requirements, here's how the data maps to the 3 logging categories:

#### 🎬 **AD_PLAYBACK** (Real-time video events)
- Video state changes (playing, paused, buffering)
- Playback progress updates
- Video loading events
- WebSocket real-time updates

#### 📊 **AD_ANALYTICS** (Historical data collection)
- Analytics API calls to `/deviceTracking/ad-playback`
- Offline queue operations
- Server response confirmations
- Data persistence operations

#### 📱 **DEVICE_TRACKING** (Real-time device + GPS tracking)
- Location updates (GPS coordinates, speed, heading)
- QR code display events
- QR code scan events
- Device status changes
- Location tracking start/stop

## Conclusion

✅ **All required data is being saved to historical storage:**
- QR code displayed events → `/deviceTracking/qr-scan`
- QR code scanned events → `/ads/qr-scan`
- Location updates → `/deviceTracking/location-update`
- Ad playback analytics → `/deviceTracking/ad-playback`

The system provides comprehensive driver tracking data for historical analysis while maintaining clean, categorized real-time logging.
