import { useEffect, useState, useCallback } from 'react';
import { webSocketService } from '../services/websocketService';

interface WebSocketState {
  isConnected: boolean;
  lastMessage: any;
  sendMessage: (event: string, data: any) => void;
  subscribe: (event: string, callback: (data: any) => void) => () => void;
}

export const useWebSocket = (): WebSocketState => {
  const [isConnected, setIsConnected] = useState(webSocketService.getConnectionState());
  const [lastMessage, setLastMessage] = useState<any>(null);

  // Handle connection status changes
  useEffect(() => {
    const handleConnect = () => {
      setIsConnected(true);
    };

    const handleDisconnect = () => {
      setIsConnected(false);
    };

    // Subscribe to connection events
    webSocketService.on('connect', handleConnect);
    webSocketService.on('disconnect', handleDisconnect);

    // Cleanup
    return () => {
      webSocketService.off('connect', handleConnect);
      webSocketService.off('disconnect', handleDisconnect);
    };
  }, []);

  // Send message through WebSocket
  const sendMessage = useCallback((event: string, data: any) => {
    webSocketService.send(event, data);
  }, []);

  // Subscribe to WebSocket events
  const subscribe = useCallback((event: string, callback: (data: any) => void) => {
    // Add the callback
    const unsubscribe = webSocketService.on(event, (data) => {
      setLastMessage({ event, data });
      callback(data);
    });

    // Return cleanup function
    return () => {
      unsubscribe();
    };
  }, []);

  return {
    isConnected,
    lastMessage,
    sendMessage,
    subscribe,
  };
};
