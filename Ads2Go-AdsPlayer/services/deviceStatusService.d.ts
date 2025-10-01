type DeviceStatus = {
  isOnline: boolean;
  lastSeen?: Date;
  error?: string;
};

declare class DeviceStatusService {
  initialize(params: {
    materialId: string;
    onStatusChange: (status: DeviceStatus) => void;
  }): void;
  
  cleanup(): void;
  sendHeartbeat(): void;
  reconnect(): void;
}

declare const deviceStatusService: DeviceStatusService;

export default deviceStatusService;
export type { DeviceStatus };
