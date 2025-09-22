class WebSocketService {
  private static instance: WebSocketService;
  private socket: WebSocket | null = null;
  private eventCallbacks: { [event: string]: ((data: any) => void)[] } = {};
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second delay
  private isConnected = false;

  private constructor() {
    this.connect();
  }

  public static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  private getWebSocketUrl(): string {
    // Enable WebSocket for admin dashboard
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? 'wss://ads2go-integration-production.up.railway.app' 
      : 'ws://localhost:5000';
    return `${baseUrl}/ws/admin-dashboard`;
  }

  private connect(): void {
    const wsUrl = this.getWebSocketUrl();
    if (!wsUrl) {
      console.log('WebSocket URL not configured - using GraphQL polling instead');
      return;
    }
    
    try {
      this.socket = new WebSocket(wsUrl);
      this.setupEventListeners();
    } catch (error) {
      console.error('WebSocket connection error:', error);
      this.handleReconnect();
    }
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.onopen = () => {
      console.log('WebSocket connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.emit('connect', {});
    };

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.emit(data.event || 'message', data.data || data);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    this.socket.onclose = () => {
      console.log('WebSocket disconnected');
      this.isConnected = false;
      this.emit('disconnect', {});
      this.handleReconnect();
    };

    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.emit('error', error);
    };
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      if (!this.isConnected) {
        this.connect();
      }
    }, Math.min(delay, 30000)); // Max 30 seconds delay
  }

  public on(event: string, callback: (data: any) => void): () => void {
    if (!this.eventCallbacks[event]) {
      this.eventCallbacks[event] = [];
    }
    this.eventCallbacks[event].push(callback);
    
    // Return unsubscribe function
    return () => this.off(event, callback);
  }

  public off(event: string, callback: (data: any) => void): void {
    if (!this.eventCallbacks[event]) return;
    this.eventCallbacks[event] = this.eventCallbacks[event].filter(cb => cb !== callback);
  }

  public emit(event: string, data: any): void {
    const callbacks = this.eventCallbacks[event] || [];
    callbacks.forEach(callback => callback(data));
  }

  public send(event: string, data: any): void {
    if (this.socket && this.isConnected) {
      this.socket.send(JSON.stringify({ event, data }));
    } else {
      console.warn('Cannot send message - WebSocket is not connected');
    }
  }

  public getConnectionState(): boolean {
    return this.isConnected;
  }
}

export const webSocketService = WebSocketService.getInstance();
