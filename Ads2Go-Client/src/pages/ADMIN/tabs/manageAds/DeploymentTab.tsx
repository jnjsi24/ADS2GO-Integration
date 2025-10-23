import React, { useState, useEffect } from 'react';
import { 
  PlayCircle, 
  Clock, 
  Activity,
  Settings 
} from 'lucide-react';
import { useQuery, useMutation } from '@apollo/client';
import {
  GET_ALL_DEPLOYMENTS,
  GET_ACTIVE_DEPLOYMENTS,
  UPDATE_LCD_SLOT_STATUS,
  REMOVE_ADS_FROM_LCD,
  type AdDeployment,
  type LCDSlot
} from '../../../../graphql/admin/ads';

type DeploymentTabProps = {
  statusFilter: string; // or stricter union type
  onStatusChange: (status: string) => void;
};


const DeploymentTab: React.FC<DeploymentTabProps> = ({
  statusFilter: parentFilter,
  onStatusChange
}) => {
  const [deploymentFilter, setDeploymentFilter] = useState(parentFilter || 'all');

  useEffect(() => {
    if (parentFilter) setDeploymentFilter(parentFilter);
  }, [parentFilter]);

  // GraphQL Hooks
  const { data: deploymentsData, loading: deploymentsLoading, refetch: refetchDeployments } = useQuery(GET_ALL_DEPLOYMENTS, {
    errorPolicy: 'all',
    fetchPolicy: 'cache-and-network'
  });

  const { data: activeDeploymentsData, loading: activeDeploymentsLoading } = useQuery(GET_ACTIVE_DEPLOYMENTS, {
    errorPolicy: 'all',
    fetchPolicy: 'cache-and-network'
  });

  // Deployment mutations
  const [updateLCDSlotStatus] = useMutation(UPDATE_LCD_SLOT_STATUS, {
    onCompleted: () => {
      refetchDeployments();
    },
    onError: (error) => {
      console.error('Error updating LCD slot:', error);
      alert(`Error updating LCD slot: ${error.message}`);
    }
  });

  const [removeAdsFromLCD] = useMutation(REMOVE_ADS_FROM_LCD, {
    onCompleted: () => {
      refetchDeployments();
    },
    onError: (error) => {
      console.error('Error removing ads from LCD:', error);
      alert(`Error removing ads: ${error.message}`);
    }
  });

  // Handler functions
  const handleLCDSlotAction = async (materialId: string, adId: string, action: string) => {
    try {
      await updateLCDSlotStatus({
        variables: {
          materialId,
          adId,
          status: action.toUpperCase()
        }
      });
    } catch (error) {
      console.error('Error updating LCD slot:', error);
    }
  };

  // Filter deployments
  const filteredDeployments = deploymentsData?.getAllDeployments?.filter((deployment: AdDeployment) => {
    // Show all deployments if filter is 'all', 'All Status', or undefined
    if (!parentFilter || parentFilter === 'all' || parentFilter.toLowerCase() === 'all status') {
      return true;
    }
    // Otherwise match the status (case-insensitive)
    return deployment.currentStatus?.toLowerCase() === parentFilter.toLowerCase();
  }) || [];


  if (deploymentsLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-lg text-gray-600">Loading deployments...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Deployment Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-3xl text-center font-bold text-blue-600">
            {deploymentsData?.getAllDeployments?.length || 0}
          </p>
          <h3 className="text-sm text-center font-medium text-gray-500">Total Devices</h3>
          <p className="text-xs text-center text-gray-400 mt-1">with deployments</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-3xl text-center font-bold text-green-600">
            {deploymentsData?.getAllDeployments?.reduce((total: number, d: AdDeployment) => 
              total + (d.lcdSlots?.filter(s => s.status === 'RUNNING').length || 0), 0) || 0}
          </p>
          <h3 className="text-sm text-center font-medium text-gray-500">Running Ads</h3>
          <p className="text-xs text-center text-gray-400 mt-1">actively playing</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-3xl text-center font-bold text-purple-600">
            {(() => {
              const now = new Date();
              return deploymentsData?.getAllDeployments?.reduce((total: number, d: AdDeployment) => {
                const scheduledCount = d.lcdSlots?.filter(s => {
                  if (s.status !== 'SCHEDULED') return false;
                  // Only count if start time is in the future
                  if (s.startTime) {
                    const startTime = new Date(s.startTime);
                    return startTime > now;
                  }
                  return true; // Include if no start time specified
                }).length || 0;
                return total + scheduledCount;
              }, 0) || 0;
            })()}
          </p>
          <h3 className="text-sm text-center font-medium text-gray-500">Scheduled Ads</h3>
          <p className="text-xs text-center text-gray-400 mt-1">waiting to start</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-3xl text-center font-bold text-gray-600">
            {deploymentsData?.getAllDeployments?.reduce((total: number, d: AdDeployment) => 
              total + (d.lcdSlots?.length || 0), 0) || 0}
          </p>
          <h3 className="text-sm text-center font-medium text-gray-500">Total Slots</h3>
          <p className="text-xs text-center text-gray-400 mt-1">ads in slots</p>
        </div>
      </div>

      {/* Deployment List */}
      {filteredDeployments.length === 0 ? (
        <div className="text-center py-10 text-gray-500">
          No deployments found
        </div>
      ) : (
        <div className="space-y-4">
          {filteredDeployments.map((deployment: AdDeployment) => (
            <div key={deployment.id} className="border border-gray-200 rounded-lg p-6 bg-white shadow-sm hover:shadow-md transition-shadow">
              {/* Header with Material ID and Status */}
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-bold text-blue-700">
                      {deployment.materialId || 'Unknown Device'}
                    </h3>
                    <span
                      className={`px-3 py-1 text-xs font-medium rounded-full ${
                        deployment.currentStatus === 'RUNNING'
                          ? 'bg-green-200 text-green-800'
                          : deployment.currentStatus === 'SCHEDULED'
                          ? 'bg-purple-200 text-purple-800'
                          : deployment.currentStatus === 'COMPLETED'
                          ? 'bg-blue-200 text-blue-800'
                          : deployment.currentStatus === 'PAUSED'
                          ? 'bg-orange-200 text-orange-800'
                          : 'bg-gray-200 text-gray-800'
                      }`}
                    >
                      {deployment.currentStatus}
                    </span>
                  </div>
                  
                  {/* Deployment ID */}
                  <div className="text-sm text-gray-600 mb-1">
                    <span className="font-medium">Deployment ID:</span> <span className="font-mono text-xs">{deployment.adDeploymentId || deployment.id}</span>
                  </div>
                  
                  {/* Driver ID */}
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">Driver:</span> <span className="font-mono text-xs">{deployment.driverId || 'Not assigned'}</span>
                  </div>
                </div>
              </div>

              {/* Deployment Metadata */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-xs">
                <div className="bg-blue-50 p-2 rounded border border-blue-200">
                  <div className="flex items-center gap-1 mb-1">
                    <Clock className="w-3 h-3 text-blue-600" />
                    <span className="font-medium text-blue-700">Created</span>
                  </div>
                  <p className="text-blue-900 font-medium">
                    {(() => {
                      try {
                        if (!deployment.createdAt) return 'N/A';
                        const date = new Date(deployment.createdAt);
                        if (isNaN(date.getTime())) return 'N/A';
                        return date.toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        });
                      } catch {
                        return 'N/A';
                      }
                    })()}
                  </p>
                </div>

                <div className="bg-orange-50 p-2 rounded border border-orange-200">
                  <div className="flex items-center gap-1 mb-1">
                    <Activity className="w-3 h-3 text-orange-600" />
                    <span className="font-medium text-orange-700">Last Updated</span>
                  </div>
                  <p className="text-orange-900 font-medium">
                    {(() => {
                      try {
                        if (!deployment.updatedAt) return 'N/A';
                        const date = new Date(deployment.updatedAt);
                        if (isNaN(date.getTime())) return 'N/A';
                        return date.toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        });
                      } catch {
                        return 'N/A';
                      }
                    })()}
                  </p>
                </div>

                <div className="bg-purple-50 p-2 rounded border border-purple-200">
                  <div className="flex items-center gap-1 mb-1">
                    <Settings className="w-3 h-3 text-purple-600" />
                    <span className="font-medium text-purple-700">Total Slots</span>
                  </div>
                  <p className="text-purple-900 font-bold text-base">
                    {deployment.lcdSlots?.length || 0}
                  </p>
                  <p className="text-purple-600 text-xs">ad slots used</p>
                </div>

                <div className="bg-green-50 p-2 rounded border border-green-200">
                  <div className="flex items-center gap-1 mb-1">
                    <PlayCircle className="w-3 h-3 text-green-600" />
                    <span className="font-medium text-green-700">Running Slots</span>
                  </div>
                  <p className="text-green-900 font-bold text-base">
                    {deployment.lcdSlots?.filter(s => s.status === 'RUNNING').length || 0}
                  </p>
                  <p className="text-green-600 text-xs">actively playing</p>
                </div>
              </div>
              
              {/* Ad Slots Section */}
              {deployment.lcdSlots && deployment.lcdSlots.length > 0 && (
                <div className="mt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Settings className="w-4 h-4 text-gray-600" />
                    <h4 className="text-sm font-medium text-gray-700">Ad Slots ({deployment.lcdSlots.length})</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {deployment.lcdSlots.map((slot: LCDSlot, index: number) => (
                      <div key={slot.id || index} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-800">Slot {slot.slotNumber}</span>
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded ${
                              slot.status === 'RUNNING'
                                ? 'bg-green-100 text-green-700'
                                : slot.status === 'SCHEDULED'
                                ? 'bg-yellow-100 text-yellow-700'
                                : slot.status === 'COMPLETED'
                                ? 'bg-blue-100 text-blue-700'
                                : slot.status === 'PAUSED'
                                ? 'bg-orange-100 text-orange-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {slot.status}
                          </span>
                        </div>
                        {slot.ad?.title && (
                          <p className="text-xs font-medium text-gray-700 truncate mb-2" title={slot.ad.title}>
                            {slot.ad.title}
                          </p>
                        )}
                        
                        {/* Deployment Date */}
                        {slot.deployedAt && (() => {
                          try {
                            const date = new Date(slot.deployedAt);
                            if (isNaN(date.getTime())) return null;
                            return (
                              <p className="text-xs text-gray-500 flex items-center gap-1">
                                <span className="font-medium">Deployed:</span>
                                {date.toLocaleString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            );
                          } catch {
                            return null;
                          }
                        })()}
                        
                        {/* Start Date */}
                        {slot.startTime && (() => {
                          try {
                            const date = new Date(slot.startTime);
                            if (isNaN(date.getTime())) return null;
                            return (
                              <p className="text-xs text-gray-500 flex items-center gap-1">
                                <span className="font-medium">Start Date:</span>
                                {date.toLocaleString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            );
                          } catch {
                            return null;
                          }
                        })()}
                        
                        {/* End Date */}
                        {slot.endTime && (() => {
                          try {
                            const date = new Date(slot.endTime);
                            if (isNaN(date.getTime())) return null;
                            return (
                              <p className="text-xs text-gray-500 flex items-center gap-1">
                                <span className="font-medium">End Date:</span>
                                {date.toLocaleString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            );
                          } catch {
                            return null;
                          }
                        })()}
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DeploymentTab;
