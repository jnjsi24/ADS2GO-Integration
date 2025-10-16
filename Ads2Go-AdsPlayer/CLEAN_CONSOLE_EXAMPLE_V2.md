# Clean Console Output - 3 Category System

## Your New Simplified Console Output

With the new 3-category logging system, your console will show only the essential data you need:

### 🎬 **AD_PLAYBACK** - Real-time video events
```
[16:00:54] 🎬 [AD_PLAYBACK] Starting ad playback tracking {"adTitle":"ice cream","adId":"68e26087dd74cf711c207e9a","duration":60}
[16:00:54] 🎬 [AD_PLAYBACK] Video loaded successfully {"mediaFile":"https://firebasestorage.googleapis.com/v0/b/ads2go-6ead4.firebasestorage.app/o/advertisements%2F1759666308556_ice%20cream%20(60).mp4"}
[16:00:54] 🎬 [AD_PLAYBACK] Playback state changed {"state":"playing","currentTime":5.2,"progress":8.7}
[16:00:54] 🎬 [AD_PLAYBACK] Ad ended {"adTitle":"ice cream","totalDuration":60,"viewedDuration":60}
```

### 📊 **AD_ANALYTICS** - Historical data collection
```
[16:00:54] 📊 [AD_ANALYTICS] Ad playback tracked in analytics {"adTitle":"ice cream","viewTime":0,"completionRate":0}
[16:00:54] 📊 [AD_ANALYTICS] Analytics data queued {"adId":"68e26087dd74cf711c207e9a","isOffline":false}
[16:00:54] 📊 [AD_ANALYTICS] Server response received {"success":true,"totalAdImpressions":2,"totalAdPlayTime":0}
[16:00:54] 📊 [AD_ANALYTICS] Data synced from offline queue {"itemsSynced":3,"totalItems":3}
```

### 📱 **DEVICE_TRACKING** - Real-time device + GPS tracking
```
[16:00:54] 📱 [DEVICE_TRACKING] QR code displayed for ad {"adTitle":"ice cream"}
[16:00:54] 📱 [DEVICE_TRACKING] Location updated {"latitude":14.56130267553293,"longitude":120.99952925505406,"speed":-1}
[16:00:54] 📱 [DEVICE_TRACKING] QR code scanned {"adId":"68e26087dd74cf711c207e9a","scanTime":"2025-10-15T16:00:54Z"}
[16:00:54] 📱 [DEVICE_TRACKING] Location tracking started
[16:00:54] 📱 [DEVICE_TRACKING] Device status changed {"isConnected":true,"isOnline":true}
```

## Before vs After Comparison

### ❌ **Before (Your Current Console)**
```
LOG  🔧 Using fallback local server URL: http://192.168.1.7:5000
LOG  🔌 [WebSocket] Loaded device info: {"deviceId": "TABLET-Apple-iPhone-XR-iOS-17-6-1-99kay6-1760362091290", "materialId": "DGL-HEADDRESS-CAR-003", "slotNumber": 2}
LOG  No materialId set, checking if registration can provide one...
LOG  🔍 Checking registration cleared flag in checkRegistrationStatus: null
LOG  🔍 Found local registration data: {"deviceId": "TABLET-Apple-iPhone-XR-iOS-17-6-1-99kay6-1760362091290", "isRegistered": true, "materialId": "DGL-HEADDRESS-CAR-003", "slotNumber": 2}
LOG  🔄 Verifying registration with server...
LOG  📍 GPS Location obtained: {"accuracy": 7.090116340637784, "lat": 14.56130267553293, "lng": 120.99952925505406}
LOG  📍 Updating tablet status with location: {"lat": 14.56130267553293, "lng": 120.99952925505406}
LOG  🔌 [WebSocket] Connected successfully
LOG  WebSocket status change received: {"error": null, "isConnected": true, "isOnline": true}
LOG  Device status changed: {"error": null, "isConnected": true, "isOnline": true}
LOG  Status update: {"newStatus": {"error": null, "isConnected": true, "isOnline": true}, "prev": {"error": "Connecting...", "isOnline": false}, "updatedStatus": {"error": null, "isConnected": true, "isOnline": true, "lastSeen": 2025-10-15T16:00:54.369Z}}
LOG  Device ID comparison: {"database": "TABLET-Apple-iPhone-XR-iOS-17-6-1-99kay6-1760362091290", "local": "TABLET-Apple-iPhone-XR-iOS-17-6-1-99kay6-1760362091290", "match": true}
LOG  ✅ Device ID already in sync
LOG  Device ID synced, retrying status update...
LOG  ⏳ Skipping GPS data in status update - coordinates are [0,0]
LOG  Updating tablet status: {"deviceId": "TABLET-Apple-iPhone-XR-iOS-17-6-1-99kay6-1760362091290", "gps": undefined, "isOnline": true, "lastReportedAt": "2025-10-15T16:00:54.400Z"}
LOG  Device ID comparison: {"database": "TABLET-Apple-iPhone-XR-iOS-17-6-1-99kay6-1760362091290", "local": "TABLET-Apple-iPhone-XR-iOS-17-6-1-99kay6-1760362091290", "match": true}
LOG  ✅ Device ID already in sync
LOG  Device ID synced, retrying status update...
LOG  Updating tablet status: {"deviceId": "TABLET-Apple-iPhone-XR-iOS-17-6-1-99kay6-1760362091290", "gps": {"lat": 14.56130267553293, "lng": 120.99952925505406}, "isOnline": true, "lastReportedAt": "2025-10-15T16:00:54.449Z"}
LOG  Tablet status updated successfully
LOG  Tablet status updated successfully
LOG  🚦 Speed limit detected: 30 km/h (School Zone)
LOG  API URL: http://192.168.1.7:5000/deviceTracking/location-update
LOG  ✅ Location tracking updated successfully
LOG  Starting continuous location tracking...
LOG  Checking server accessibility at: http://192.168.1.7:5000
LOG  Server is accessible
LOG  Location tracking started
LOG  Continuous location tracking started successfully
LOG  Current ad: {"adId": "No ID", "adStartTime": "Not set", "adTitle": "No ad", "currentAdIndex": 0, "duration": 0, "isCompanyAd": false, "isOffline": false, "mediaFile": "No media", "networkStatus": true, "totalAds": 0}
LOG  🔍 Checking registration cleared flag in checkRegistrationStatus: null
LOG  🔍 Found local registration data: {"deviceId": "TABLET-Apple-iPhone-XR-iOS-17-6-1-99kay6-1760362091290", "isRegistered": true, "materialId": "DGL-HEADDRESS-CAR-003", "slotNumber": 2}
LOG  🔄 Verifying registration with server...
LOG  Current ad: {"adId": "No ID", "adStartTime": "Not set", "adTitle": "No ad", "currentAdIndex": 0, "duration": 0, "isCompanyAd": false, "isOffline": false, "mediaFile": "No media", "networkStatus": false, "totalAds": 0}
LOG  ✅ Server confirmed registration is still valid
LOG  Current ad: {"adId": "No ID", "adStartTime": "Not set", "adTitle": "No ad", "currentAdIndex": 0, "duration": 0, "isCompanyAd": false, "isOffline": false, "mediaFile": "No media", "networkStatus": false, "totalAds": 0}
LOG  🏢 Fetching company ads...
LOG  🏢 Fetching active company ads...
LOG  Network is offline, loading cached ads
LOG  🔌 [WebSocket] Using server URL: http://192.168.1.7:5000
LOG  🔌 [WebSocket] WebSocket URL: ws://192.168.1.7:5000/ws/playback?deviceId=TABLET-Apple-iPhone-XR-iOS-17-6-1-99kay6-1760362091290&materialId=DGL-HEADDRESS-CAR-003&slotNumber=2
LOG  🔌 [WebSocket] Connecting to playback server...
LOG  🔌 [WebSocket] Already connected or connecting, skipping connection attempt
LOG  🔌 [AdPlayer] WebSocket connected for real-time updates
LOG  Current ad: {"adId": "No ID", "adStartTime": "Not set", "adTitle": "No ad", "currentAdIndex": 0, "duration": 0, "isCompanyAd": false, "isOffline": false, "mediaFile": "No media", "networkStatus": false, "totalAds": 0}
LOG  🔌 [WebSocket] Connected successfully
LOG  Current ad: {"adId": "No ID", "adStartTime": "Not set", "adTitle": "No ad", "currentAdIndex": 0, "duration": 0, "isCompanyAd": false, "isOffline": false, "mediaFile": "No media", "networkStatus": true, "totalAds": 0}
LOG  ✅ Fetched 1 active company ads
LOG  ✅ Loaded 1 company ads
LOG  Current ad: {"adId": "No ID", "adStartTime": "Not set", "adTitle": "No ad", "currentAdIndex": 0, "duration": 0, "isCompanyAd": false, "isOffline": false, "mediaFile": "No media", "networkStatus": true, "totalAds": 0}
LOG  Filtered 3 ads to 3 valid ads
LOG  Loaded valid cached ads: 3
LOG  Current ad: {"adId": "68e26087dd74cf711c207e9a", "adStartTime": "Not set", "adTitle": "ice cream", "currentAdIndex": 0, "duration": 60, "isCompanyAd": false, "isOffline": false, "mediaFile": "https://firebasestorage.googleapis.com/v0/b/ads2go-6ead4.firebasestorage.app/o/advertisements%2F1759666308556_ice%20cream%20(60).mp4?alt=media&token=8dac7f22-9b29-4979-a92d-32bf8ae9b53a", "networkStatus": true, "totalAds": 3}
LOG  ⚠️ [expo-av]: Video component from `expo-av` is deprecated in favor of `expo-video`. See the documentation at https://docs.expo.dev/versions/latest/sdk/video/ for the new API reference.
LOG  📱 QR code displayed for ad: ice cream
LOG  🎬 Starting ad playback tracking: ice cream
LOG  🎬 Tracking ad playback: ice cream (60s) - View time: 0s - ONLINE
LOG  🎬 [AdPlayer] New ad loaded: ice cream - waiting for video to load before sending WebSocket updates
LOG  Current ad: {"adId": "68e26087dd74cf711c207e9a", "adStartTime": "Set", "adTitle": "ice cream", "currentAdIndex": 0, "duration": 60, "isCompanyAd": false, "isOffline": false, "mediaFile": "https://firebasestorage.googleapis.com/v0/b/ads2go-6ead4.firebasestorage.app/o/advertisements%2F1759666308556_ice%20cream%20(60).mp4?alt=media&token=8dac7f22-9b29-4979-a92d-32bf8ae9b53a", "networkStatus": true, "totalAds": 3}
LOG  🔍 Generating QR data for ad: {"adId": "68e26087dd74cf711c207e9a", "adSlotNumber": 1, "adTitle": "ice cream", "currentAdIndex": 0, "hasWebsite": true, "redirectUrl": "https://ice-cream.org/about-the-ice-cream-alliance/history-of-ice-cream/", "website": "https://ice-cream.org/about-the-ice-cream-alliance/history-of-ice-cream/"}
LOG  🔍 Using tracking URL: http://192.168.1.7:5000/qr-track.html?ad_id=68e26087dd74cf711c207e9a&ad_title=ice+cream&material_id=DGL-HEADDRESS-CAR-003&slot_number=1&website=https%3A%2F%2Fice-cream.org%2Fabout-the-ice-cream-alliance%2Fhistory-of-ice-cream%2F&redirect_url=https%3A%2F%2Fice-cream.org%2Fabout-the-ice-cream-alliance%2Fhistory-of-ice-cream%2F&scan_time=1760544057603
LOG  Current ad: {"adId": "68e26087dd74cf711c207e9a", "adStartTime": "Set", "adTitle": "ice cream", "currentAdIndex": 0, "duration": 60, "isCompanyAd": false, "isOffline": false, "mediaFile": "https://firebasestorage.googleapis.com/v0/b/ads2go-6ead4.firebasestorage.app/o/advertisements%2F1759666308556_ice%20cream%20(60).mp4?alt=media&token=8dac7f22-9b29-4979-a92d-32bf8ae9b53a", "networkStatus": true, "totalAds": 3}
LOG  🔍 [OfflineQueue] Sending ad playback: ice cream
LOG  🔍 [OfflineQueue] DeviceId: TABLET-Apple-iPhone-XR-iOS-17-6-1-99kay6-1760362091290
LOG  🔍 [OfflineQueue] Queued slotNumber: 2
LOG  🔍 [OfflineQueue] Registration slotNumber: 2
LOG  🔍 [OfflineQueue] Using deviceSlot: 2
LOG  ✅ Ad playback tracked in analytics: ice cream
LOG  Ad playback tracked successfully: {"data": {"currentAd": {"adDuration": 60, "adId": "68e26087dd74cf711c207e9a", "adTitle": "ice cream", "completionRate": 0, "currentTime": 0, "endTime": null, "impressions": 1, "materialId": "DGL-HEADDRESS-CAR-003", "progress": 0, "slotNumber": 1, "startTime": "2025-10-15T16:00:53.181Z", "state": "playing", "userId": "68dff5213c0070dca160aea1", "viewTime": 0}, "totalAdImpressions": 2, "totalAdPlayTime": 0, "totalAdsPlayed": 2}, "message": "Ad playback tracked successfully", "success": true}
LOG  ✅ Ad playback tracked successfully: ice cream
LOG  🔄 [WebSocket] Skipping sync request - no ads currently playing or still loading
LOG  🚦 Speed limit detected: 30 km/h (School Zone)
LOG  API URL: http://192.168.1.7:5000/deviceTracking/location-update
LOG  ✅ Location tracking updated successfully
LOG  Location updated: {"accuracy": 7.090116340637784, "heading": -1, "latitude": 14.56130267553293, "longitude": 120.99952925505406, "speed": -1}
LOG  Video loaded successfully: https://firebasestorage.googleapis.com/v0/b/ads2go-6ead4.firebasestorage.app/o/advertisements%2F1759666308556_ice%20cream%20(60).mp4?alt=media&token=8dac7f22-9b29-4979-a92d-32bf8ae9b53a
LOG  🎬 [WebSocket] Sent detailed state update: {"adIndex": "N/A", "adTitle": "ice cream", "currentTime": "0.0s", "deviceId": "TABLET-Apple-iPhone-XR-iOS-17-6-1-99kay6-1760362091290", "isCompanyAd": false, "mediaFile": "N/A", "progress": "0.0%", "state": "buffering", "totalAds": "N/A"}
LOG  🎬 [WebSocket] Sent detailed state update: {"adIndex": "N/A", "adTitle": "ice cream", "currentTime": "0.0s", "deviceId": "TABLET-Apple-iPhone-XR-iOS-17-6-1-99kay6-1760362091290", "isCompanyAd": false, "mediaFile": "N/A", "progress": "0.0%", "state": "buffering", "totalAds": "N/A"}
LOG  Current ad: {"adId": "68e26087dd74cf711c207e9a", "adStartTime": "Set", "adTitle": "ice cream", "currentAdIndex": 0, "duration": 60, "isCompanyAd": false, "isOffline": false, "mediaFile": "https://firebasestorage.googleapis.com/v0/b/ads2go-6ead4.firebasestorage.app/o/advertisements%2F1759666308556_ice%20cream%20(60).mp4?alt=media&token=8dac7f22-9b29-4979-a92d-32bf8ae9b53a", "networkStatus": true, "totalAds": 3}
LOG  Current ad: {"adId": "68e26087dd74cf711c207e9a", "adStartTime": "Set", "adTitle": "ice cream", "currentAdIndex": 0, "duration": 60, "isCompanyAd": false, "isOffline": false, "mediaFile": "https://firebasestorage.googleapis.com/v0/b/ads2go-6ead4.firebasestorage.app/o/advertisements%2F1759666308556_ice%20cream%20(60).mp4?alt=media&token=8dac7f22-9b29-4979-a92d-32bf8ae9b53a", "networkStatus": true, "totalAds": 3}
LOG  Video ready for display: https://firebasestorage.googleapis.com/v0/b/ads2go-6ead4.firebasestorage.app/o/advertisements%2F1759666308556_ice%20cream%20(60).mp4?alt=media&token=8dac7f22-9b29-4979-a92d-32bf8ae9b53a
LOG  Current ad: {"adId": "68e26087dd74cf711c207e9a", "adStartTime": "Set", "adTitle": "ice cream", "currentAdIndex": 0, "duration": 60, "isCompanyAd": false, "isOffline": false, "mediaFile": "https://firebasestorage.googleapis.com/v0/b/ads2go-6ead4.firebasestorage.app/o/advertisements%2F1759666308556_ice%20cream%20(60).mp4?alt=media&token=8dac7f22-9b29-4979-a92d-32bf8ae9b53a", "networkStatus": true, "totalAds": 3}
LOG  Current ad: {"adId": "68e26087dd74cf711c207e9a", "adStartTime": "Set", "adTitle": "ice cream", "currentAdIndex": 0, "duration": 60, "isCompanyAd": false, "isOffline": false, "mediaFile": "https://firebasestorage.googleapis.com/v0/b/ads2go-6ead4.firebasestorage.app/o/advertisements%2F1759666308556_ice%20cream%20(60).mp4?alt=media&token=8dac7f22-9b29-4979-a92d-32bf8ae9b53a", "networkStatus": true, "totalAds": 3}
LOG  🚦 Speed limit detected: 30 km/h (School Zone)
LOG  API URL: http://192.168.1.7:5000/deviceTracking/location-update
LOG  ✅ Location tracking updated successfully
LOG  Location updated: {"accuracy": 7.090116340637784, "heading": -1, "latitude": 14.56130267553293, "longitude": 120.99952925505406, "speed": -1}
LOG  🚦 Speed limit detected: 30 km/h (School Zone)
LOG  API URL: http://192.168.1.7:5000/deviceTracking/location-update
LOG  ✅ Location tracking updated successfully
LOG  Location updated: {"accuracy": 7.090116340637784, "heading": -1, "latitude": 14.56130267553293, "longitude": 120.99952925505406, "speed": -1}
```

### ✅ **After (Clean 3-Category System)**
```
[16:00:54] 🎬 [AD_PLAYBACK] Starting ad playback tracking {"adTitle":"ice cream","adId":"68e26087dd74cf711c207e9a","duration":60}
[16:00:54] 📱 [DEVICE_TRACKING] QR code displayed for ad {"adTitle":"ice cream"}
[16:00:54] 📊 [AD_ANALYTICS] Ad playback tracked in analytics {"adTitle":"ice cream","viewTime":0,"completionRate":0}
[16:00:54] 🎬 [AD_PLAYBACK] Video loaded successfully {"mediaFile":"https://firebasestorage.googleapis.com/v0/b/ads2go-6ead4.firebasestorage.app/o/advertisements%2F1759666308556_ice%20cream%20(60).mp4"}
[16:00:54] 📊 [AD_ANALYTICS] Server response received {"success":true,"totalAdImpressions":2,"totalAdPlayTime":0}
[16:00:54] 📱 [DEVICE_TRACKING] Location updated {"latitude":14.56130267553293,"longitude":120.99952925505406,"speed":-1}
[16:00:54] 🎬 [AD_PLAYBACK] Playback state changed {"state":"playing","currentTime":5.2,"progress":8.7}
[16:00:54] 📱 [DEVICE_TRACKING] Location updated {"latitude":14.56130267553293,"longitude":120.99952925505406,"speed":-1}
```

## Benefits of the New System

1. **90% Less Noise** - Only shows essential data
2. **Clear Categories** - Easy to understand what each log represents
3. **Structured Data** - JSON objects instead of concatenated strings
4. **Real-time Focus** - AD_PLAYBACK for video events
5. **Historical Focus** - AD_ANALYTICS for data collection
6. **Device Focus** - DEVICE_TRACKING for GPS and device status

## Configuration Options

```typescript
// Show all 3 categories (recommended)
configureCleanLogging();

// Show only ad playback and errors (production)
configureProductionLogging();

// Show only analytics and device tracking (debugging data flow)
configureAnalyticsLogging();

// Show all categories with full details (development)
configureDevelopmentLogging();
```

This gives you exactly what you need: clean, categorized console output focused on the 3 essential data types for your ad player system!
