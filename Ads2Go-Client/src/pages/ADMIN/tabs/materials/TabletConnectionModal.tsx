import React from 'react';
import { X, Copy, UserX, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface TabletUnit {
  tabletNumber: number;
  deviceId?: string;
  status: string;
  gps: {
    lat: number | null;
    lng: number | null;
  } | null;
  lastSeen: string | null;
}

interface Tablet {
  id: string;
  materialId: string;
  carGroupId: string;
  tablets: TabletUnit[];
  createdAt: string;
  updatedAt: string;
}

interface ConnectedDevice {
  deviceId: string;
  status: string;
  lastSeen?: string;
  gps?: {
    lat: number;
    lng: number;
  };
}

interface TabletConnectionStatus {
  isConnected: boolean;
  connectedDevice?: ConnectedDevice;
  materialId: string;
  slotNumber: number;
  carGroupId: string;
}

interface TabletConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  materialId: string | null;
  slotNumber: number | null;
  tabletData: { getTabletsByMaterial: Tablet[] } | undefined;
  connectionStatusData: { getTabletConnectionStatus: TabletConnectionStatus } | undefined;
  tabletLoading: boolean;
  tabletError: any;
  connectionStatusLoading: boolean;
  connectionStatusError: any;
  unregistering: boolean;
  refreshingConnectionStatus?: boolean;
  creatingTabletConfig: boolean;
  onRefetchTabletData: () => void;
  onRefetchConnectionStatus: () => void;
  onCreateTabletConfiguration: () => void;
  onUnregisterTablet: () => void;
  onCopyToClipboard: (text: string) => void;
}

const TabletConnectionModal: React.FC<TabletConnectionModalProps> = ({
  isOpen,
  onClose,
  materialId,
  slotNumber,
  tabletData,
  connectionStatusData,
  tabletLoading,
  tabletError,
  connectionStatusLoading,
  connectionStatusError,
  unregistering,
  refreshingConnectionStatus = false,
  creatingTabletConfig,
  onRefetchTabletData,
  onRefetchConnectionStatus,
  onCreateTabletConfiguration,
  onUnregisterTablet,
  onCopyToClipboard
}) => {
  if (!isOpen || !materialId || !slotNumber) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white rounded-2xl p-6 w-full max-w-4xl mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-800">
            Tablet Connection Details - Slot {slotNumber}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={20} />
          </button>
        </div>

        {tabletLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600">Loading tablet data...</span>
          </div>
        ) : tabletError ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="text-red-500 mb-2">❌</div>
              <span className="text-gray-600">Error loading tablet data.</span>
              <br />
              <span className="text-sm text-gray-500 mb-4">{tabletError.message}</span>
              <button
                onClick={onRefetchTabletData}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 mx-auto"
              >
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Retry
              </button>
            </div>
          </div>
        ) : !tabletData?.getTabletsByMaterial?.[0] ? (
           <div className="flex items-center justify-center py-8">
             <div className="text-center">
               <div className="text-red-500 mb-2">⚠️</div>
               <span className="text-gray-600">No tablet configuration found for this material.</span>
               <br />
               <span className="text-sm text-gray-500 mb-4">Please ensure this is a HEADDRESS material.</span>
               <button
                 onClick={onCreateTabletConfiguration}
                 disabled={creatingTabletConfig}
                 className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 flex items-center gap-2 mx-auto"
               >
                 {creatingTabletConfig ? (
                   <>
                     <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                     Creating...
                   </>
                 ) : (
                   <>
                     <QrCode size={16} />
                     Create Tablet Configuration
                   </>
                 )}
               </button>
             </div>
           </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-6">
              {/* Connection Details */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-800 mb-3">Connection Information</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-700">Material ID:</span>
                    <span className="text-gray-600 font-mono">{materialId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-700">Slot Number:</span>
                    <span className="text-gray-600 font-mono">{slotNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-700">Car Group ID:</span>
                    <span className="text-gray-600 font-mono">{tabletData.getTabletsByMaterial[0].carGroupId}</span>
                  </div>
                </div>
              </div>

              {/* Connection Status */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-gray-800">Connection Status</h3>
                <button
                  onClick={() => onRefetchConnectionStatus()}
                  disabled={connectionStatusLoading || refreshingConnectionStatus || (!tabletData?.getTabletsByMaterial || tabletData.getTabletsByMaterial.length === 0) || (!connectionStatusData?.getTabletConnectionStatus && connectionStatusError)}
                  className="flex items-center gap-1 px-2 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  <div className={`w-3 h-3 border border-white rounded-full ${(connectionStatusLoading || refreshingConnectionStatus) ? 'animate-spin' : ''}`}></div>
                  Refresh
                </button>
              </div>
              {(connectionStatusLoading || refreshingConnectionStatus) ? (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  <span className="ml-2 text-gray-600">Checking connection status...</span>
                </div>
              ) : !tabletData?.getTabletsByMaterial || tabletData.getTabletsByMaterial.length === 0 ? (
                <div className="text-center py-4">
                  <div className="text-gray-400 mb-2">📱</div>
                  <span className="text-gray-600">This slot is not yet connected to a tablet</span>
                  <br />
                  <span className="text-sm text-gray-500 mb-2">Please connect to a tablet first using the QR code below</span>
                </div>
              ) : connectionStatusError ? (
                <div className="text-center py-4">
                  <div className="text-gray-400 mb-2">📱</div>
                  <span className="text-gray-600">Please connect this slot to a tablet first</span>
                  <br />
                  <span className="text-sm text-gray-500 mb-2">Use the QR code below to Connect a Tablet to this Slot or Input the Connection Information above Manually </span>
                </div>
              ) : connectionStatusData?.getTabletConnectionStatus ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-700">Status:</span>
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${connectionStatusData.getTabletConnectionStatus.isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <span className={`font-semibold ${connectionStatusData.getTabletConnectionStatus.isConnected ? 'text-green-600' : 'text-red-600'}`}>
                        {connectionStatusData.getTabletConnectionStatus.isConnected ? 'Connected' : 'Not Connected'}
                      </span>
                    </div>
                  </div>
                  
                  {connectionStatusData.getTabletConnectionStatus.isConnected && connectionStatusData.getTabletConnectionStatus.connectedDevice && (
                    <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-2">
                      <h4 className="font-medium text-gray-800">Connected Device Details:</h4>
                      <div className="text-sm space-y-1">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Device ID:</span>
                          <span className="font-mono text-gray-800">{connectionStatusData.getTabletConnectionStatus.connectedDevice.deviceId}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Status:</span>
                          <span className="text-gray-800">{connectionStatusData.getTabletConnectionStatus.connectedDevice.status}</span>
                        </div>
                        {connectionStatusData.getTabletConnectionStatus.connectedDevice.lastSeen && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Last Seen:</span>
                            <span className="text-gray-800">{new Date(connectionStatusData.getTabletConnectionStatus.connectedDevice.lastSeen).toLocaleString()}</span>
                          </div>
                        )}
                        {connectionStatusData.getTabletConnectionStatus.connectedDevice.gps && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">GPS:</span>
                            <span className="text-gray-800">
                              {connectionStatusData.getTabletConnectionStatus.connectedDevice.gps.lat?.toFixed(6)}, {connectionStatusData.getTabletConnectionStatus.connectedDevice.gps.lng?.toFixed(6)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {connectionStatusData.getTabletConnectionStatus.isConnected && (
                    <button
                      onClick={onUnregisterTablet}
                      disabled={unregistering}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-400"
                    >
                      {unregistering ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Unregistering...
                        </>
                      ) : (
                        <>
                          <UserX size={16} />
                          Unregister Tablet
                        </>
                      )}
                    </button>
                  )}
                </div>
              ) : (
                <div className="text-center py-4">
                  <div className="text-gray-400 mb-2">📱</div>
                  <span className="text-gray-600">This slot is not yet connected to a tablet</span>
                  <br />
                  <span className="text-sm text-gray-500 mb-2">Please connect to a tablet first using the QR code below</span>
                </div>
              )}
            </div>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* QR Code */}
              <div className="flex flex-col items-center space-y-4">
                <h3 className="font-semibold text-gray-800">QR Code</h3>
                <div className="bg-white p-3 border border-gray-200 rounded-lg">
                  {(() => {
                    const qrData = {
                      materialId: materialId,
                      slotNumber: slotNumber,
                      carGroupId: tabletData.getTabletsByMaterial[0].carGroupId
                    };
                    console.log('QR Code data:', qrData);
                    return (
                      <QRCodeSVG 
                        value={JSON.stringify(qrData)}
                        size={150}
                        level="M"
                        includeMargin={true}
                      />
                    );
                  })()}
                </div>
                <p className="text-xs text-gray-500 text-center">
                  Scan this QR code with the AndroidPlayer app to connect
                </p>
              </div>

              {/* Manual Code */}
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-800">Manual Code</h3>
                <div className="bg-gray-100 p-3 rounded-lg">
                  <code className="text-sm text-gray-800 break-all">
                    {JSON.stringify({
                      materialId: materialId,
                      slotNumber: slotNumber,
                      carGroupId: tabletData.getTabletsByMaterial[0].carGroupId
                    }, null, 2)}
                  </code>
                </div>
                <button
                  onClick={() => {
                    const connectionData = {
                      materialId: materialId,
                      slotNumber: slotNumber,
                      carGroupId: tabletData.getTabletsByMaterial[0].carGroupId
                    };
                    console.log('Copying connection data:', connectionData);
                    onCopyToClipboard(JSON.stringify(connectionData, null, 2));
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Copy size={16} />
                  Copy to Clipboard
                </button>
              </div>

              {/* Instructions */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h3 className="font-semibold text-yellow-800 mb-2">Instructions</h3>
                <div className="text-sm text-yellow-700 space-y-1">
                  <p>1. Scan the QR code or copy the manual code</p>
                  <p>2. Open the AndroidPlayer app on your tablet</p>
                  <p>3. Enter the connection details</p>
                  <p>4. The tablet will connect to the system</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TabletConnectionModal;
