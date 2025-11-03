import React, { useState, useEffect } from 'react';
import { 
  PlayCircle, 
  Clock, 
  Activity,
  Settings,
  ChevronLeft,
  ChevronRight
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
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

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
    }
  });

  const [removeAdsFromLCD] = useMutation(REMOVE_ADS_FROM_LCD, {
    onCompleted: () => {
      refetchDeployments();
    },
    onError: (error) => {
      console.error('Error removing ads from LCD:', error);
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

  // Pagination calculations
  const totalPages = Math.ceil(filteredDeployments.length / itemsPerPage);
  const paginatedDeployments = filteredDeployments.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Pagination handlers
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

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
      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-3xl text-center font-bold text-blue-600">
            {deploymentsData?.getAllDeployments?.length || 0}
          </p>
          <h3 className="text-sm text-center font-medium text-gray-500">Total Devices</h3>
          <p className="text-xs text-center text-gray-400 mt-1">with deployments</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-3xl text-center font-bold text-green-600">
            {(() => {
              const now = new Date();
              // Count UNIQUE ads that are ACTUALLY PLAYING based on dates
              const uniqueAdIds = new Set<string>();
              deploymentsData?.getAllDeployments?.forEach((d: AdDeployment) => {
                d.lcdSlots?.forEach(s => {
                  // Ad is "running" if:
                  // 1. Ad exists and is PAID
                  // 2. Current date is >= start date
                  // 3. Current date is <= end date
                  if (s.ad && s.ad.paymentStatus === 'PAID') {
                    const startTime = s.startTime ? new Date(s.startTime) : null;
                    const endTime = s.endTime ? new Date(s.endTime) : null;
                    
                    // Check if ad is currently playing (within date range)
                    if (startTime && endTime && startTime <= now && now <= endTime) {
                      uniqueAdIds.add(s.adId);
                    }
                  }
                });
              });
              return uniqueAdIds.size;
            })()}
          </p>
          <h3 className="text-sm text-center font-medium text-gray-500">Running Ads</h3>
          <p className="text-xs text-center text-gray-400 mt-1">actively playing</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-3xl text-center font-bold text-purple-600">
            {(() => {
              const now = new Date();
              // Count UNIQUE ads that are PAID but haven't started yet (start date in future)
              const uniqueScheduledAdIds = new Set<string>();
              deploymentsData?.getAllDeployments?.forEach((d: AdDeployment) => {
                d.lcdSlots?.forEach(s => {
                  // Ad is "scheduled" if:
                  // 1. Ad exists and is PAID
                  // 2. Start date is in the FUTURE (not yet started)
                  if (s.ad && s.ad.paymentStatus === 'PAID') {
                    const startTime = s.startTime ? new Date(s.startTime) : null;
                    
                    // Check if ad hasn't started yet
                    if (startTime && startTime > now) {
                      uniqueScheduledAdIds.add(s.adId);
                    }
                  }
                });
              });
              return uniqueScheduledAdIds.size;
            })()}
          </p>
          <h3 className="text-sm text-center font-medium text-gray-500">Scheduled Ads</h3>
          <p className="text-xs text-center text-gray-400 mt-1">waiting to start</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-3xl text-center font-bold text-gray-600">
            {(() => {
              // Total slots = number of devices × 5 slots per device
              const totalDevices = deploymentsData?.getAllDeployments?.length || 0;
              return totalDevices * 5;
            })()}
          </p>
          <h3 className="text-sm text-center font-medium text-gray-500">Total Slots</h3>
          <p className="text-xs text-center text-gray-400 mt-1">all device slots</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-3xl text-center font-bold text-orange-600">
            {(() => {
              // Calculate available slots: (devices × 5 slots) - paid ads
              const totalDevices = deploymentsData?.getAllDeployments?.length || 0;
              const totalPossibleSlots = totalDevices * 5;
              const paidAdsCount = deploymentsData?.getAllDeployments?.reduce((total: number, d: AdDeployment) => {
                const paidSlots = d.lcdSlots?.filter(s => 
                  s.ad && s.ad.paymentStatus === 'PAID'
                ).length || 0;
                return total + paidSlots;
              }, 0) || 0;
              return totalPossibleSlots - paidAdsCount;
            })()}
          </p>
          <h3 className="text-sm text-center font-medium text-gray-500">Available Slots</h3>
          <p className="text-xs text-center text-gray-400 mt-1">remaining capacity</p>
        </div>
      </div>

      {/* Deployment List */}
      {filteredDeployments.length === 0 ? (
        <div className="text-center py-10 text-gray-500">
          No deployments found
        </div>
      ) : (
        <div className="space-y-4">
          {paginatedDeployments.map((deployment: AdDeployment) => (
            <div key={deployment.id} className="border border-gray-200 rounded-lg p-6 bg-white shadow-sm hover:shadow-md transition-shadow">
              {/* Header with Material ID and Status */}
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-bold text-blue-700">
                      {deployment.materialId || 'Unknown Device'}
                    </h3>
                    {/* Deployment status - show RUNNING (finished ads are removed from slots) */}
                    <span className="px-3 py-1 text-xs font-medium rounded-full bg-green-200 text-green-800">
                      RUNNING
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
                          <div className="flex gap-1 flex-wrap justify-end">
                            {/* Show RUNNING badge if ad is currently playing */}
                            {(() => {
                              const now = new Date();
                              const startTime = slot.startTime ? new Date(slot.startTime) : null;
                              const endTime = slot.endTime ? new Date(slot.endTime) : null;
                              const isRunning = startTime && endTime && startTime <= now && now <= endTime;
                              
                              if (isRunning) {
                                return (
                                  <span className="px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-700">
                                    RUNNING
                                  </span>
                                );
                              }
                              return null;
                            })()}
                            
                            {/* Show SCHEDULED badge if ad was scheduled (has future or past scheduled start date) */}
                            {slot.status === 'SCHEDULED' && (
                              <span className="px-2 py-1 text-xs font-medium rounded bg-purple-100 text-purple-700">
                                SCHEDULED
                              </span>
                            )}
                            
                            {/* Show ENDED badge if ad is completed */}
                            {(() => {
                              const now = new Date();
                              const endTime = slot.endTime ? new Date(slot.endTime) : null;
                              const isEnded = endTime && now > endTime;
                              
                              if (isEnded || slot.status === 'COMPLETED' || slot.status === 'ENDED') {
                                return (
                                  <span className="px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-700">
                                    ENDED
                                  </span>
                                );
                              }
                              return null;
                            })()}
                            
                            {/* Show other statuses */}
                            {slot.status === 'PAUSED' && (
                              <span className="px-2 py-1 text-xs font-medium rounded bg-orange-100 text-orange-700">
                                PAUSED
                              </span>
                            )}
                            
                            {slot.status === 'REMOVED' && (
                              <span className="px-2 py-1 text-xs font-medium rounded bg-red-100 text-red-700">
                                REMOVED
                              </span>
                            )}
                            
                            {slot.status === 'CANCELLED' && (
                              <span className="px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-700">
                                CANCELLED
                              </span>
                            )}
                          </div>
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

          {/* Pagination Controls */}
          {filteredDeployments.length > 0 && (
            <div className="flex items-center justify-center px-4 py-4 mt-4 border-t">
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePreviousPage}
                  disabled={currentPage === 1}
                  className="flex items-center px-3 py-1 text-sm rounded font-semibold hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  <span>Previous</span>
                </button>

                <div className="flex gap-1">
                  {(() => {
                    const pages = [];
                    const maxVisiblePages = 5;
                    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
                    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

                    if (endPage - startPage < maxVisiblePages - 1) {
                      startPage = Math.max(1, endPage - maxVisiblePages + 1);
                    }

                    for (let i = startPage; i <= endPage; i++) {
                      pages.push(
                        <button
                          key={i}
                          onClick={() => handlePageChange(i)}
                          className={`px-3 py-1 text-sm rounded ${
                            currentPage === i
                              ? "border border-gray-300 text-black"
                              : "text-gray-700 hover:border border-gray-300"
                          }`}
                        >
                          {i}
                        </button>
                      );
                    }

                    if (endPage < totalPages) {
                      pages.push(
                        <span key="ellipsis" className="px-2 text-gray-500">
                          …
                        </span>
                      );
                    }

                    return pages;
                  })()}
                </div>

                <button
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages}
                  className="flex items-center px-3 py-1 text-sm rounded font-semibold hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4 ml-1" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DeploymentTab;
