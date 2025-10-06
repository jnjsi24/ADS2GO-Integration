# Device-Specific Analytics API Documentation

This document describes the new device-specific analytics functions that allow users to view detailed analytics data for specific devices by pulling data from the DeviceDataHistoryV2 collection.

## Overview

The device-specific analytics system provides comprehensive insights into individual device performance, including:

- **Device Information**: Hardware specs, OS details, and identification
- **Performance Metrics**: Ad plays, QR scans, uptime, and engagement
- **Temporal Analysis**: Hourly patterns, daily breakdowns, and trends
- **Location Insights**: GPS tracking and movement analysis
- **Ad Performance**: Individual ad performance on specific devices
- **Compliance Data**: Uptime percentages and operational status

## API Endpoints

### 1. Get Device-Specific Analytics
**Endpoint**: `GET /analytics/user/:userId/device/:deviceId`

**Description**: Retrieves comprehensive analytics data for a specific device from DeviceDataHistoryV2.

**Parameters**:
- `userId` (path): User ID to verify access permissions
- `deviceId` (path): Material ID of the device to analyze
- `startDate` (query, optional): Start date for data filtering (ISO string)
- `endDate` (query, optional): End date for data filtering (ISO string)

**Response**:
```json
{
  "success": true,
  "data": {
    "success": true,
    "deviceAnalytics": {
      "deviceInfo": {
        "materialId": "DGL-HEADDRESS-CAR-005",
        "carGroupId": "GRP-B3D26445",
        "deviceName": "Device Name",
        "deviceType": "Android Tablet",
        "osName": "Android",
        "osVersion": "11.0",
        "platform": "Android",
        "brand": "Samsung",
        "modelName": "Galaxy Tab A7",
        "screenResolution": "1920x1200"
      },
      "dateRange": {
        "startDate": "2025-09-06T04:46:30.906Z",
        "endDate": "2025-10-06T04:46:30.906Z",
        "totalDays": 2
      },
      "totals": {
        "totalAdPlays": 392,
        "totalQRScans": 5,
        "totalDistanceTraveled": 45.2,
        "totalHoursOnline": 2.13,
        "totalAdImpressions": 392,
        "totalAdPlayTime": 4460.28
      },
      "averages": {
        "averageDailyPlays": 196,
        "averageDailyQRScans": 2.5,
        "averageDailyHours": 1.06,
        "averageDailyDistance": 22.6,
        "averageCompletionRate": 16.33
      },
      "performance": {
        "totalAdPlayTimeHours": 1.24,
        "qrScanConversionRate": 1.28,
        "complianceRate": 85.5,
        "uptimePercentage": 13.30
      },
      "adPerformance": [
        {
          "adId": "ad123",
          "adTitle": "Sample Ad",
          "totalPlays": 150,
          "totalViewTime": 4500,
          "totalImpressions": 150,
          "averageCompletionRate": 100,
          "firstPlayed": "2025-09-06T08:00:00Z",
          "lastPlayed": "2025-09-06T18:00:00Z",
          "playCount": 150
        }
      ],
      "qrScanBreakdown": [
        {
          "adId": "ad123",
          "adTitle": "Sample Ad",
          "totalScans": 3,
          "scans": [...]
        }
      ],
      "hourlyActivity": [
        {
          "hour": 0,
          "totalPlays": 5,
          "totalQRScans": 0,
          "totalDistance": 2.1,
          "totalHoursOnline": 0.1,
          "activityCount": 10
        }
      ],
      "dailyBreakdown": [
        {
          "date": "2025-09-06T00:00:00Z",
          "totalAdPlays": 196,
          "totalQRScans": 2,
          "totalHoursOnline": 1.06,
          "totalDistanceTraveled": 22.6,
          "totalAdImpressions": 196,
          "totalAdPlayTime": 2230.14,
          "complianceRate": 85.5,
          "adCompletionRate": 16.33,
          "isDisplaying": true,
          "maintenanceMode": false,
          "networkStatus": {
            "isOnline": true,
            "connectionType": "WiFi",
            "signalStrength": 4
          }
        }
      ],
      "locationInsights": {
        "totalLocationPoints": 1112,
        "averageDailyLocations": 556,
        "maxDailyLocations": 1112
      },
      "lifetimeTotals": {
        "totalAdPlays": 1500,
        "totalQRScans": 25,
        "totalDistanceTraveled": 200.5,
        "totalHoursOnline": 50.2,
        "totalAdImpressions": 1500,
        "totalAdPlayTime": 18000,
        "totalDays": 30,
        "averageDailyHours": 1.67,
        "complianceRate": 85.5
      },
      "lastUpdated": "2025-10-06T04:46:30.906Z"
    }
  },
  "message": "Device-specific analytics retrieved successfully"
}
```

### 2. Get Multiple Devices Analytics
**Endpoint**: `GET /analytics/user/:userId/devices`

**Description**: Retrieves analytics summary for multiple devices, sorted by performance.

**Parameters**:
- `userId` (path): User ID to verify access permissions
- `deviceIds` (query, optional): Comma-separated list of device IDs to analyze
- `startDate` (query, optional): Start date for data filtering (ISO string)
- `endDate` (query, optional): End date for data filtering (ISO string)

**Response**:
```json
{
  "success": true,
  "data": {
    "success": true,
    "devicesAnalytics": [
      {
        "deviceInfo": {
          "materialId": "DGL-HEADDRESS-CAR-005",
          "carGroupId": "GRP-B3D26445",
          "deviceName": "Device Name",
          "deviceType": "Android Tablet"
        },
        "summary": {
          "totalAdPlays": 392,
          "totalQRScans": 5,
          "totalHoursOnline": 2.13,
          "totalAdImpressions": 392,
          "totalAdPlayTime": 4460.28,
          "averageCompletionRate": 16.33,
          "uptimePercentage": 13.30,
          "qrScanConversionRate": 1.28
        },
        "dateRange": {
          "startDate": "2025-09-29T04:46:31.430Z",
          "endDate": "2025-10-06T04:46:31.430Z",
          "totalDays": 7
        },
        "lastActivity": "2025-10-06T04:46:30.906Z"
      }
    ],
    "totalDevices": 1,
    "dateRange": {
      "startDate": "2025-09-29T04:46:31.430Z",
      "endDate": "2025-10-06T04:46:31.430Z"
    }
  },
  "message": "Multiple devices analytics retrieved successfully"
}
```

## Data Sources

### DeviceDataHistoryV2 Collection
The device-specific analytics pull data from the `DeviceDataHistoryV2` collection, which contains:

- **Daily Data Array**: Historical daily performance data
- **Device Information**: Hardware and software specifications
- **Lifetime Totals**: Aggregated metrics across all time
- **Location History**: GPS tracking data points
- **Ad Performance**: Individual ad metrics per device
- **QR Scan Details**: Detailed QR scan information
- **Hourly Stats**: Activity patterns by hour
- **Compliance Data**: Uptime and operational status

### Key Metrics Explained

#### Performance Metrics
- **Total Ad Plays**: Number of times ads were played on the device
- **Total QR Scans**: Number of QR codes scanned from the device
- **Total Hours Online**: Device uptime in hours
- **QR Scan Conversion Rate**: Percentage of impressions that resulted in QR scans
- **Uptime Percentage**: Percentage of target hours (8 hours) the device was online
- **Compliance Rate**: Device operational compliance percentage

#### Temporal Analysis
- **Hourly Activity**: Activity patterns throughout the day (0-23 hours)
- **Daily Breakdown**: Day-by-day performance metrics
- **Averages**: Daily averages for key metrics
- **Date Range**: Customizable time period for analysis

#### Location Insights
- **Total Location Points**: Number of GPS coordinates recorded
- **Average Daily Locations**: Average GPS points per day
- **Max Daily Locations**: Maximum GPS points in a single day

## Usage Examples

### Frontend Integration

```javascript
// Get device-specific analytics
const getDeviceAnalytics = async (userId, deviceId, startDate, endDate) => {
  const response = await fetch(
    `/api/analytics/user/${userId}/device/${deviceId}?startDate=${startDate}&endDate=${endDate}`
  );
  return await response.json();
};

// Get multiple devices analytics
const getMultipleDevicesAnalytics = async (userId, deviceIds, startDate, endDate) => {
  const deviceIdsParam = deviceIds.join(',');
  const response = await fetch(
    `/api/analytics/user/${userId}/devices?deviceIds=${deviceIdsParam}&startDate=${startDate}&endDate=${endDate}`
  );
  return await response.json();
};

// Usage example
const analytics = await getDeviceAnalytics(
  'user123',
  'DGL-HEADDRESS-CAR-005',
  '2025-09-01',
  '2025-09-30'
);

console.log('Device Performance:', analytics.data.deviceAnalytics.totals);
console.log('Ad Performance:', analytics.data.deviceAnalytics.adPerformance);
console.log('Hourly Activity:', analytics.data.deviceAnalytics.hourlyActivity);
```

### React Component Example

```jsx
import React, { useState, useEffect } from 'react';

const DeviceAnalytics = ({ userId, deviceId }) => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const response = await fetch(
          `/api/analytics/user/${userId}/device/${deviceId}`
        );
        const data = await response.json();
        setAnalytics(data.data.deviceAnalytics);
      } catch (error) {
        console.error('Failed to fetch device analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [userId, deviceId]);

  if (loading) return <div>Loading device analytics...</div>;
  if (!analytics) return <div>No analytics data available</div>;

  return (
    <div className="device-analytics">
      <h2>Device Analytics: {analytics.deviceInfo.deviceName}</h2>
      
      <div className="metrics-grid">
        <div className="metric-card">
          <h3>Total Ad Plays</h3>
          <p>{analytics.totals.totalAdPlays}</p>
        </div>
        
        <div className="metric-card">
          <h3>QR Scans</h3>
          <p>{analytics.totals.totalQRScans}</p>
        </div>
        
        <div className="metric-card">
          <h3>Uptime</h3>
          <p>{analytics.performance.uptimePercentage.toFixed(1)}%</p>
        </div>
        
        <div className="metric-card">
          <h3>Conversion Rate</h3>
          <p>{analytics.performance.qrScanConversionRate.toFixed(2)}%</p>
        </div>
      </div>

      <div className="ad-performance">
        <h3>Ad Performance</h3>
        {analytics.adPerformance.map(ad => (
          <div key={ad.adId} className="ad-item">
            <h4>{ad.adTitle}</h4>
            <p>Plays: {ad.totalPlays}</p>
            <p>Completion Rate: {ad.averageCompletionRate.toFixed(1)}%</p>
          </div>
        ))}
      </div>

      <div className="hourly-activity">
        <h3>Hourly Activity Pattern</h3>
        <div className="activity-chart">
          {analytics.hourlyActivity.map(hour => (
            <div 
              key={hour.hour} 
              className="activity-bar"
              style={{ height: `${(hour.totalPlays / 50) * 100}px` }}
              title={`Hour ${hour.hour}: ${hour.totalPlays} plays`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default DeviceAnalytics;
```

## Error Handling

The API returns appropriate error responses for various scenarios:

```json
{
  "success": false,
  "message": "Device not found or no data available",
  "deviceAnalytics": null
}
```

Common error scenarios:
- **Device not found**: Device ID doesn't exist in DeviceDataHistoryV2
- **No user ads**: User has no active ads to analyze
- **Invalid date range**: Malformed start/end dates
- **Access denied**: User doesn't have permission to view device data

## Performance Considerations

- **Data Filtering**: Always use date ranges to limit data processing
- **Caching**: Consider caching results for frequently accessed devices
- **Pagination**: For large datasets, implement pagination for daily breakdowns
- **Indexing**: Ensure proper database indexes on materialId and date fields

## Security

- **User Verification**: All endpoints verify user access to device data
- **Data Privacy**: Only return data for devices associated with user's ads
- **Input Validation**: All parameters are validated and sanitized
- **Rate Limiting**: Consider implementing rate limiting for API endpoints

## Future Enhancements

- **Real-time Updates**: WebSocket integration for live device monitoring
- **Predictive Analytics**: Machine learning for performance predictions
- **Comparative Analysis**: Device-to-device performance comparisons
- **Export Functionality**: CSV/PDF export of device analytics
- **Alert System**: Automated alerts for device performance issues
