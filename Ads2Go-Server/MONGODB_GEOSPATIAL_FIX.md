# MongoDB Geospatial Index Fix

## Problem Identified

The location tracking was failing with this MongoDB error:
```
Can't extract geo keys: ... can't project geometry into spherical CRS
```

## Root Cause

MongoDB's 2dsphere index expects coordinates in **GeoJSON format** with coordinates as `[longitude, latitude]` arrays, but we were storing them as `{lat, lng}` objects.

## Solution Implemented

### 1. **Updated Location Schema**

**Before:**
```javascript
const LocationPointSchema = new mongoose.Schema({
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  // ... other fields
});
```

**After:**
```javascript
const LocationPointSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['Point'],
    default: 'Point'
  },
  coordinates: {
    type: [Number], // [longitude, latitude] - MongoDB 2dsphere format
    required: true,
    validate: {
      validator: function(coords) {
        return coords.length === 2 && 
               typeof coords[0] === 'number' && 
               typeof coords[1] === 'number' &&
               coords[0] >= -180 && coords[0] <= 180 && // longitude
               coords[1] >= -90 && coords[1] <= 90;     // latitude
      },
      message: 'Coordinates must be [longitude, latitude] array with valid values'
    }
  },
  // ... other fields
});
```

### 2. **Updated Location Storage**

**Before:**
```javascript
const locationPoint = {
  lat: 14.5645227,
  lng: 121.0454227,
  // ... other fields
};
```

**After:**
```javascript
const locationPoint = {
  type: 'Point',
  coordinates: [121.0454227, 14.5645227], // [longitude, latitude]
  // ... other fields
};
```

### 3. **Updated MongoDB Index**

**Before:**
```javascript
ScreenTrackingSchema.index({ 'currentLocation': '2dsphere' });
```

**After:**
```javascript
ScreenTrackingSchema.index({ 'currentLocation.coordinates': '2dsphere' });
```

### 4. **Added Helper Methods**

```javascript
// Virtual properties for easy access
ScreenTrackingSchema.virtual('currentLat').get(function() {
  return this.currentLocation?.coordinates?.[1] || null;
});

ScreenTrackingSchema.virtual('currentLng').get(function() {
  return this.currentLocation?.coordinates?.[0] || null;
});

// Helper method for API responses
ScreenTrackingSchema.methods.getFormattedLocation = function() {
  if (!this.currentLocation) return null;
  
  return {
    lat: this.currentLocation.coordinates[1], // latitude
    lng: this.currentLocation.coordinates[0], // longitude
    timestamp: this.currentLocation.timestamp,
    speed: this.currentLocation.speed,
    heading: this.currentLocation.heading,
    accuracy: this.currentLocation.accuracy,
    address: this.currentLocation.address
  };
};
```

### 5. **Updated Distance Calculations**

**Before:**
```javascript
const distance = this.calculateDistance(prevPoint.lat, prevPoint.lng, lat, lng);
```

**After:**
```javascript
const prevLng = prevPoint.coordinates[0];
const prevLat = prevPoint.coordinates[1];
const distance = this.calculateDistance(prevLat, prevLng, lat, lng);
```

## Migration Required

### **Run the Migration Script**

To update existing data in the database:

```bash
cd Ads2Go-Server
node scripts/migrate-location-format.js
```

This script will:
- ✅ Convert all existing `{lat, lng}` objects to GeoJSON format
- ✅ Update `currentLocation` fields
- ✅ Update `locationHistory` in current sessions
- ✅ Update `locationHistory` in daily sessions
- ✅ Preserve all other data

### **What the Migration Does**

1. **Finds all ScreenTracking documents**
2. **Converts old format to new format:**
   ```javascript
   // Old format
   { lat: 14.5645227, lng: 121.0454227 }
   
   // New format
   { 
     type: 'Point', 
     coordinates: [121.0454227, 14.5645227] 
   }
   ```
3. **Updates all location data** (currentLocation, locationHistory)
4. **Saves changes** to database

## Testing the Fix

### 1. **Run Migration**
```bash
cd Ads2Go-Server
node scripts/migrate-location-format.js
```

### 2. **Restart Backend Server**
```bash
npm start
```

### 3. **Test Location Tracking**
- Register a tablet in AndroidPlayerExpo
- Location tracking should start automatically
- Check server logs - should see "Location updated successfully"
- No more MongoDB geospatial errors

### 4. **Verify Data Format**
Check the database to ensure coordinates are stored correctly:
```javascript
// Should see this format in MongoDB:
{
  currentLocation: {
    type: 'Point',
    coordinates: [121.0454227, 14.5645227], // [lng, lat]
    timestamp: Date,
    speed: 0,
    heading: 0,
    accuracy: 0,
    address: "Address string"
  }
}
```

## Benefits of This Fix

### ✅ **MongoDB Compatibility**
- Proper GeoJSON format for 2dsphere indexes
- No more geospatial projection errors
- Efficient geospatial queries

### ✅ **Standards Compliance**
- Follows GeoJSON specification
- Compatible with mapping libraries
- Industry standard format

### ✅ **Performance**
- Optimized geospatial indexing
- Faster location-based queries
- Better database performance

### ✅ **Future-Proof**
- Compatible with MongoDB geospatial features
- Ready for advanced location queries
- Scalable for large datasets

## API Response Format

The API still returns coordinates in the familiar `{lat, lng}` format:

```json
{
  "success": true,
  "data": {
    "currentLocation": {
      "lat": 14.5645227,
      "lng": 121.0454227,
      "timestamp": "2024-01-15T10:30:00.000Z",
      "speed": 25,
      "heading": 45,
      "accuracy": 5,
      "address": "Makati, Philippines"
    }
  }
}
```

## Troubleshooting

### **If Migration Fails**
1. Check MongoDB connection
2. Ensure database is accessible
3. Check for data corruption
4. Run migration in smaller batches

### **If Location Tracking Still Fails**
1. Verify migration completed successfully
2. Check server logs for new errors
3. Restart backend server
4. Clear and re-register tablet

### **If Coordinates Look Wrong**
1. Verify migration converted correctly
2. Check that longitude comes before latitude in arrays
3. Ensure coordinate validation is working

## Summary

This fix resolves the MongoDB geospatial indexing error by:
- ✅ Converting to proper GeoJSON format
- ✅ Updating database schema
- ✅ Providing migration script
- ✅ Maintaining API compatibility
- ✅ Improving performance and standards compliance

The location tracking should now work reliably without MongoDB errors!
