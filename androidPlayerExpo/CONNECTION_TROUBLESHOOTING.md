# AndroidPlayer Connection Troubleshooting Guide

## Understanding "CONNECTION CLOSED NORMALLY" Error

The "CONNECTION CLOSED NORMALLY" error occurs when the WebSocket connection closes with code **1000**, which indicates a normal closure. This is not necessarily an error, but rather indicates that the connection was closed intentionally.

## Root Causes & Solutions

### 1. **Server-Side Timeouts**
**Problem**: Server closes connections after 90 seconds of no pong response
**Solution**: 
- Increased server timeout from 60s to 90s
- Added proper close codes (1000) instead of terminate()
- Improved logging for timeout reasons

### 2. **Client-Side Reconnection Logic**
**Problem**: Client may not handle normal closures appropriately
**Solution**:
- Added logic to distinguish between normal and abnormal closures
- Increased max reconnection attempts from 5 to 10
- Added exponential backoff with jitter
- Improved error messaging

### 3. **Network Issues**
**Problem**: Intermittent network connectivity
**Solution**:
- Added connection health monitoring
- Increased pong timeout from 90s to 120s
- Added retry logic for network failures

## Configuration Changes Made

### Client-Side (AndroidPlayer)
```typescript
// Increased timeouts and retry attempts
const PONG_TIMEOUT = 120000;  // 120 seconds (was 90s)
const MAX_RECONNECT_ATTEMPTS = 10; // Increased from 5
const CONNECTION_HEALTH_CHECK_INTERVAL = 10000; // 10 seconds

// Better close code handling
const shouldReconnect = event.code !== 1000 || newReconnectAttempts < maxReconnectAttempts;
```

### Server-Side
```javascript
// Increased pong timeout
if (ws.lastPong && (now - ws.lastPong) > 90000) { // was 60000
  console.log(`Device ${deviceId} connection timed out (no pong for 90s)`);
  deadConnections.push(deviceId);
  ws.close(1000, 'Connection timeout - no pong received'); // Proper close instead of terminate
}
```

## Troubleshooting Steps

### 1. **Check Server Logs**
Look for these log messages:
```
Device {deviceId} connection timed out (no pong for 90s)
WebSocket upgrade request for device: {deviceId}
Active WebSocket connections: {count}
```

### 2. **Check Client Logs**
Look for these log messages:
```
[useDeviceStatus] WebSocket closed: 1000 Connection closed normally
[useDeviceStatus] Reconnecting in {delay}ms (attempt {attempt}/{max})
[useDeviceStatus] Not reconnecting - code: 1000, attempts: {attempt}/{max}
```

### 3. **Verify Network Connectivity**
- Check if the device can reach the server
- Verify the API URL configuration
- Test with a simple HTTP request first

### 4. **Check Environment Variables**
Ensure these are properly set:
```bash
EXPO_PUBLIC_API_URL=http://your-server:5000
EXPO_PUBLIC_TABLET_ID=your-tablet-id
EXPO_PUBLIC_MATERIAL_ID=your-material-id
```

### 5. **Monitor Connection Health**
The app now includes connection health monitoring:
- Last pong received timestamp
- Consecutive failure count
- Connection health status

## Common Issues & Solutions

### Issue: Connection closes immediately after opening
**Cause**: Server rejecting connection due to missing device ID
**Solution**: Verify device ID is properly set and sent in WebSocket URL

### Issue: Connection closes after 30-60 seconds
**Cause**: Ping/pong timeout
**Solution**: Check network stability and server ping interval

### Issue: Connection closes with code 1000 repeatedly
**Cause**: Server intentionally closing connections
**Solution**: Check server logs for timeout reasons

### Issue: No reconnection attempts
**Cause**: Max reconnection attempts reached
**Solution**: Reset the app or check network connectivity

## Debugging Commands

### Check WebSocket Connection
```bash
# Test WebSocket connection manually
wscat -c ws://your-server:5000/ws/status?deviceId=test-device&materialId=test-material
```

### Check Server Status
```bash
# Check if server is running
curl http://your-server:5000/health

# Check WebSocket endpoint
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: x3JJHMbDL1EzLkh9GBhXDw==" http://your-server:5000/ws/status?deviceId=test
```

## Prevention Measures

1. **Regular Health Checks**: Monitor connection status regularly
2. **Proper Error Handling**: Handle all WebSocket close codes appropriately
3. **Network Monitoring**: Monitor network stability
4. **Server Monitoring**: Monitor server resources and performance
5. **Logging**: Maintain comprehensive logs for debugging

## Additional Resources

- [WebSocket Close Codes Reference](https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent)
- [Expo WebSocket Documentation](https://docs.expo.dev/versions/latest/sdk/websocket/)
- [Node.js WebSocket Server Documentation](https://github.com/websockets/ws)

## Support

If you continue to experience issues after following this guide:

1. Check the server logs for specific error messages
2. Verify network connectivity between client and server
3. Test with a minimal WebSocket client to isolate the issue
4. Check server resources (CPU, memory, network)
5. Verify firewall and proxy settings
