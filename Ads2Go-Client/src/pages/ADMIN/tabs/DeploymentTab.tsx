import React, { useState } from 'react';
import { 
  PlayCircle, 
  Pause, 
  Play, 
  Square, 
  Tablet, 
  Users, 
  Clock, 
  Activity, 
  CalendarPlus, 
  CalendarMinus, 
  Settings 
} from 'lucide-react';
import { useQuery, useMutation } from '@apollo/client';
import {
  GET_ALL_DEPLOYMENTS,
  GET_ACTIVE_DEPLOYMENTS,
  UPDATE_DEPLOYMENT_STATUS,
  UPDATE_LCD_SLOT_STATUS,
  REMOVE_ADS_FROM_LCD,
  type AdDeployment,
  type LCDSlot
} from '../../../graphql/admin/ads';

interface DeploymentTabProps {
  // Add any props you need for the deployment tab
}

const DeploymentTab: React.FC<DeploymentTabProps> = () => {
  const [deploymentFilter, setDeploymentFilter] = useState<'all' | 'RUNNING' | 'SCHEDULED' | 'COMPLETED' | 'PAUSED'>('all');

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
  const [updateDeploymentStatus] = useMutation(UPDATE_DEPLOYMENT_STATUS, {
    onCompleted: () => {
      refetchDeployments();
    },
    onError: (error) => {
      console.error('Error updating deployment:', error);
      alert(`Error updating deployment: ${error.message}`);
    }
  });

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
  const handleDeploymentAction = async (deploymentId: string, action: string) => {
    try {
      await updateDeploymentStatus({
        variables: {
          id: deploymentId,
          status: action.toUpperCase()
        }
      });
    } catch (error) {
      console.error('Error updating deployment:', error);
    }
  };

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
    return deploymentFilter === 'all' || deployment.currentStatus === deploymentFilter;
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
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-800">Ad Deployment</h2>
        <div className="flex gap-2">
          <button className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">
            Deploy Ad
          </button>
          <button className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
            Bulk Actions
          </button>
        </div>
      </div>

      {/* Deployment Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-gray-500">Active Deployments</h3>
          <p className="text-2xl font-bold text-green-600">
            {activeDeploymentsData?.getActiveDeployments?.length || 0}
          </p>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-gray-500">Total Deployments</h3>
          <p className="text-2xl font-bold text-blue-600">
            {deploymentsData?.getAllDeployments?.length || 0}
          </p>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-gray-500">Running Ads</h3>
          <p className="text-2xl font-bold text-purple-600">
            {deploymentsData?.getAllDeployments?.filter((d: AdDeployment) => d.currentStatus === 'RUNNING').length || 0}
          </p>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-gray-500">Scheduled</h3>
          <p className="text-2xl font-bold text-yellow-600">
            {deploymentsData?.getAllDeployments?.filter((d: AdDeployment) => d.currentStatus === 'SCHEDULED').length || 0}
          </p>
        </div>
      </div>

      {/* Filter Dropdown */}
      <div className="mb-6">
        <div className="relative w-40">
          <select
            className="appearance-none w-full text-xs text-black rounded-xl pl-5 pr-10 py-3 shadow-md focus:outline-none bg-white"
            value={deploymentFilter}
            onChange={e =>
              setDeploymentFilter(e.target.value as 'all' | 'RUNNING' | 'SCHEDULED' | 'COMPLETED' | 'PAUSED')
            }
          >
            <option value="all">All Status</option>
            <option value="RUNNING">Running</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="COMPLETED">Completed</option>
            <option value="PAUSED">Paused</option>
          </select>

          {/* SVG Arrow */}
          <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
            <svg
              className="w-4 h-4 text-gray-500"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
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
            <div key={deployment.id} className="border border-gray-200 rounded-lg p-6 bg-white shadow-sm">
              {/* Header with ID and Status */}
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-800">
                      {deployment.ad?.title || ''}
                    </h3>
                    <span
                      className={`px-3 py-1 text-xs font-medium rounded-full ${
                        deployment.currentStatus === 'RUNNING'
                          ? 'bg-green-200 text-green-800'
                          : deployment.currentStatus === 'SCHEDULED'
                          ? 'bg-yellow-200 text-yellow-800'
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
                  <div className="text-sm text-gray-600 mb-2">
                    <span className="font-medium">Deployment ID:</span> {deployment.adDeploymentId || deployment.id}
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDeploymentAction(deployment.id, 'pause')}
                    className="p-2 text-gray-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                    title="Pause"
                  >
                    <Pause className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeploymentAction(deployment.id, 'running')}
                    className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                    title="Resume"
                  >
                    <Play className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeploymentAction(deployment.id, 'cancelled')}
                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Cancel"
                  >
                    <Square className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Deployment Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                {/* Material ID */}
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Tablet className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-medium text-gray-700">Material ID</span>
                  </div>
                  <p className="text-sm text-gray-900 font-mono">{deployment.materialId}</p>
                </div>

                {/* Driver ID */}
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="w-4 h-4 text-green-500" />
                    <span className="text-sm font-medium text-gray-700">Driver ID</span>
                  </div>
                  <p className="text-sm text-gray-900 font-mono">{deployment.driverId}</p>
                </div>

                {/* Created Date */}
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-purple-500" />
                    <span className="text-sm font-medium text-gray-700">Created</span>
                  </div>
                        <p className="text-sm text-gray-900">
                          {deployment.createdAt ? new Date(deployment.createdAt).toLocaleString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          }) : 'N/A'}
                        </p>
                </div>

                {/* Updated Date */}
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Activity className="w-4 h-4 text-orange-500" />
                    <span className="text-sm font-medium text-gray-700">Last Updated</span>
                  </div>
                        <p className="text-sm text-gray-900">
                          {deployment.updatedAt ? new Date(deployment.updatedAt).toLocaleString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          }) : 'N/A'}
                        </p>
                </div>

                {/* Start Time */}
                {deployment.startTime && (
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <CalendarPlus className="w-4 h-4 text-green-500" />
                      <span className="text-sm font-medium text-gray-700">Start Time</span>
                    </div>
                          <p className="text-sm text-gray-900">
                            {new Date(deployment.startTime).toLocaleString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                  </div>
                )}

                {/* End Time */}
                {deployment.endTime && (
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <CalendarMinus className="w-4 h-4 text-red-500" />
                      <span className="text-sm font-medium text-gray-700">End Time</span>
                    </div>
                          <p className="text-sm text-gray-900">
                            {new Date(deployment.endTime).toLocaleString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                  </div>
                )}
              </div>
              
              {/* LCD Slots Section */}
              {deployment.lcdSlots && deployment.lcdSlots.length > 0 && (
                <div className="mt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Settings className="w-4 h-4 text-gray-600" />
                    <h4 className="text-sm font-medium text-gray-700">LCD Slots ({deployment.lcdSlots.length})</h4>
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
                          <p className="text-xs text-gray-600 truncate" title={slot.ad.title}>
                            {slot.ad.title}
                          </p>
                        )}
                              {slot.deployedAt && (
                                <p className="text-xs text-gray-500 mt-1">
                                  Deployed: {new Date(slot.deployedAt).toLocaleString('en-US', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </p>
                              )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Additional Info */}
              <div className="mt-4 pt-3 border-t border-gray-200">
                <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>Version: {deployment.__v ?? 0}</span>
                  <span>ID: {deployment.id}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DeploymentTab;
