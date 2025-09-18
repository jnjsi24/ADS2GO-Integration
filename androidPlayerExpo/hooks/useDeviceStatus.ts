import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Application from 'expo-application';

interface WebSocketMessage {
  type: string;
  event?: string;
  [key: string]: any;
}

interface DeviceStatus {
  isConnected: boolean;
  isOnline: boolean;
  lastSeen?: string;
  error?: string;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
}

const PING_INTERVAL = 30000; // 30 seconds
const PONG_TIMEOUT = 90000;  // 90 seconds
const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_RECONNECT_DELAY = 1000; // 1 second
const MAX_RECONNECT_DELAY = 30000; // 30 seconds

const useDeviceStatus = (materialId: string) => {
  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastPongRef = useRef<number>(Date.now());
  const isConnectingRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const deviceIdRef = useRef<string>('unknown-device');
  const materialIdRef = useRef<string>(materialId);
  
  // State
  const [status, setStatus] = useState<DeviceStatus>({
    isConnected: false,
    isOnline: false,
    reconnectAttempts: 0,
    maxReconnectAttempts: MAX_RECONNECT_ATTEMPTS,
  });

  // Cleanup function to close WebSocket and clear intervals
  const cleanup = useCallback(() => {
    console.log('[useDeviceStatus] Cleaning up WebSocket connection');
    
    // Clear ping interval
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    
    // Clear reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    // Close WebSocket connection
    if (wsRef.current) {
      try {
        wsRef.current.onopen = null;
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.onmessage = null;
        
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.close();
        }
      } catch (error) {
        console.error('Error closing WebSocket:', error);
      } finally {
        wsRef.current = null;
      }
    }
    
    isConnectingRef.current = false;
  }, []);

  // Send status update to server
  const sendStatusUpdate = useCallback((ws: WebSocket) => {
    try {
      const statusUpdate = {
        type: 'status',
        deviceId: deviceIdRef.current,
        materialId: materialIdRef.current,
        timestamp: new Date().toISOString(),
        platform: Platform.OS,
        deviceName: Device.modelName || 'unknown',
        osVersion: Device.osVersion || 'unknown',
      };
      
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(statusUpdate));
      }
    } catch (error) {
      console.error('Error sending status update:', error);
    }
  }, []);

  // Handle WebSocket connection
  const connect = useCallback(() => {
    // Prevent multiple connection attempts
    if (isConnectingRef.current) return;
    
    const currentMaterialId = materialIdRef.current;
    if (!currentMaterialId) {
      console.warn('[useDeviceStatus] Cannot connect: materialId is required');
      setStatus(prev => ({
        ...prev,
        isConnected: false,
        isOnline: false,
        error: 'Material ID is required',
      }));
      return;
    }
    
    // Clean up any existing connection
    cleanup();
    
    isConnectingRef.current = true;
    
    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.100.22:5000';
      const wsProtocol = apiUrl.startsWith('https') ? 'wss' : 'ws';
      const baseUrl = apiUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
      const wsUrl = `${wsProtocol}://${baseUrl}/ws/status?deviceId=${encodeURIComponent(deviceIdRef.current)}&materialId=${encodeURIComponent(currentMaterialId)}`;
      
      console.log('[useDeviceStatus] Connecting to WebSocket:', wsUrl);
      
      // Create WebSocket instance
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      
      // Set up WebSocket event handlers
      ws.onopen = () => {
        console.log('[useDeviceStatus] WebSocket connection established');
        isConnectingRef.current = false;
        reconnectAttemptsRef.current = 0;
        
        setStatus(prev => ({
          ...prev,
          isConnected: true,
          isOnline: true,
          lastSeen: new Date().toISOString(),
          error: undefined,
          reconnectAttempts: 0,
        }));
        
        // Send initial status update
        sendStatusUpdate(ws);
        
        // Set up ping interval (30 seconds)
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            // Check last pong time (90s timeout)
            if (Date.now() - lastPongRef.current > PONG_TIMEOUT) {
              console.warn('[useDeviceStatus] No pong received, reconnecting...');
              ws.close();
              return;
            }
            
            // Send ping
            try {
              ws.send(JSON.stringify({ type: 'ping' }));
              console.log('[useDeviceStatus] Ping sent');
            } catch (error) {
              console.error('[useDeviceStatus] Error sending ping:', error);
              ws.close();
            }
          }
        }, PING_INTERVAL) as unknown as NodeJS.Timeout;
      };
      
      ws.onmessage = (event: MessageEvent) => {
        try {
          const message = JSON.parse(event.data as string) as WebSocketMessage;
          
          // Handle pong message
          if (message.type === 'pong') {
            lastPongRef.current = Date.now();
            return;
          }
          
          // Handle status updates
          if (message.event === 'deviceUpdate' || message.event === 'deviceList') {
            setStatus(prev => ({
              ...prev,
              isOnline: true,
              lastSeen: new Date().toISOString(),
            }));
          }
        } catch (error) {
          console.error('[useDeviceStatus] Error processing message:', error);
        }
      };
      
      ws.onerror = (error: Event) => {
        console.error('[useDeviceStatus] WebSocket error:', error);
        setStatus(prev => ({
          ...prev,
          isConnected: false,
          isOnline: false,
          error: 'Connection error',
        }));
      };
      
      ws.onclose = (event: CloseEvent) => {
        console.log(`[useDeviceStatus] WebSocket closed: ${event.code} ${event.reason}`);
        
        setStatus(prev => {
          const newReconnectAttempts = prev.reconnectAttempts + 1;
          const maxReconnectAttempts = MAX_RECONNECT_ATTEMPTS;
          
          // Schedule reconnection if we haven't exceeded max attempts
          if (newReconnectAttempts < maxReconnectAttempts) {
            const delay = Math.min(BASE_RECONNECT_DELAY * Math.pow(2, newReconnectAttempts - 1), MAX_RECONNECT_DELAY);
            console.log(`[useDeviceStatus] Reconnecting in ${delay}ms (attempt ${newReconnectAttempts + 1}/${maxReconnectAttempts})`);
            
            // Clear any existing timeout
            if (reconnectTimeoutRef.current) {
              clearTimeout(reconnectTimeoutRef.current);
            }
            
            // Set new timeout
            reconnectTimeoutRef.current = setTimeout(() => {
              connect();
            }, delay) as unknown as NodeJS.Timeout;
          }
          
          return {
            ...prev,
            isConnected: false,
            isOnline: false,
            reconnectAttempts: newReconnectAttempts,
            error: newReconnectAttempts >= maxReconnectAttempts ? 'Max reconnection attempts reached' : prev.error,
          };
        });
      };
      
    } catch (error) {
      console.error('[useDeviceStatus] Error creating WebSocket:', error);
      isConnectingRef.current = false;
      setStatus(prev => ({
        ...prev,
        isConnected: false,
        isOnline: false,
        error: 'Failed to connect',
      }));
    }
  }, [cleanup, sendStatusUpdate]);
  
  // Get device ID on mount
  useEffect(() => {
    const getDeviceId = async () => {
      try {
        let deviceId = 'unknown-device';
        if (Platform.OS === 'android') {
          deviceId = await Application.getAndroidId() || 'unknown-android';
        } else if (Platform.OS === 'ios') {
          deviceId = await Application.getIosIdForVendorAsync() || 'unknown-ios';
        }
        deviceIdRef.current = deviceId;
        
        // Connect once we have the device ID
        if (materialIdRef.current) {
          connect();
        }
      } catch (error) {
        console.error('Error getting device ID:', error);
      }
    };
    
    getDeviceId();
    
    // Cleanup on unmount
    return () => {
      cleanup();
    };
  }, [connect, cleanup]);
  
  // Update materialId ref when it changes
  useEffect(() => {
    materialIdRef.current = materialId;
    
    // Reconnect if we have a new materialId
    if (materialId) {
      connect();
    }
  }, [materialId, connect]);
  
  // Handle app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      console.log(`[useDeviceStatus] App state changed to: ${nextAppState}`);
      
      if (nextAppState === 'active') {
        // App came to foreground, try to reconnect if not connected
        if (!status.isConnected && materialIdRef.current) {
          connect();
        }
      } else if (nextAppState === 'background') {
        // App went to background, clean up the connection
        cleanup();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [status.isConnected, connect, cleanup]);
  
  return {
    ...status,
    connect,
    disconnect: cleanup,
  };
};

export default useDeviceStatus;
