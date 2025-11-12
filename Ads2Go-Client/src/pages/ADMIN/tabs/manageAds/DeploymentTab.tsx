import React, { useState, useEffect } from 'react';
import { 
  PlayCircle, 
  Clock, 
  Activity,
  Settings,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Move,
  X
} from 'lucide-react';
import { useQuery, useMutation } from '@apollo/client';
import {
  GET_ALL_DEPLOYMENTS,
  GET_ACTIVE_DEPLOYMENTS,
  UPDATE_LCD_SLOT_STATUS,
  REMOVE_ADS_FROM_LCD,
  CREATE_DEPLOYMENT,
  type AdDeployment,
  type LCDSlot
} from '../../../../graphql/admin/ads';
import { GET_ALL_MATERIALS } from '../../../../graphql/admin/queries/materials';
import ConfirmationModal from '../../../../components/ConfirmationModal';

type DeploymentTabProps = {
  statusFilter: string; // or stricter union type
  onStatusChange: (status: string) => void;
};


const DeploymentTab: React.FC<DeploymentTabProps> = ({
  statusFilter: parentFilter,
  onStatusChange
}) => {
  const [deploymentFilter, setDeploymentFilter] = useState(parentFilter || 'all');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Edit mode state - track which deployments are in edit mode
  const [editModeDeployments, setEditModeDeployments] = useState<Set<string>>(new Set());
  
  // Drag and drop state
  const [draggedSlot, setDraggedSlot] = useState<{
    slot: LCDSlot;
    sourceMaterialId: string;
    sourceDeploymentId: string;
  } | null>(null);
  const [dragOverDeployment, setDragOverDeployment] = useState<string | null>(null);

  // Confirmation modals state
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    slot: LCDSlot | null;
    materialId: string;
    adName: string;
  }>({
    isOpen: false,
    slot: null,
    materialId: '',
    adName: ''
  });

  const [moveConfirmation, setMoveConfirmation] = useState<{
    isOpen: boolean;
    slot: LCDSlot | null;
    sourceMaterialId: string;
    sourceDeviceName: string;
    targetMaterialId: string;
    targetDeviceName: string;
    sourceSlots: number;
    targetSlots: number;
  }>({
    isOpen: false,
    slot: null,
    sourceMaterialId: '',
    sourceDeviceName: '',
    targetMaterialId: '',
    targetDeviceName: '',
    sourceSlots: 0,
    targetSlots: 0
  });

  const [isProcessing, setIsProcessing] = useState(false);
  
  // Error state for showing error modal
  const [errorModal, setErrorModal] = useState<{
    isOpen: boolean;
    message: string;
  }>({
    isOpen: false,
    message: ''
  });

  // Success state for showing success modal
  const [successModal, setSuccessModal] = useState<{
    isOpen: boolean;
    message: string;
  }>({
    isOpen: false,
    message: ''
  });

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

  // Fetch materials to get Material _id from materialId string
  const { data: materialsData } = useQuery(GET_ALL_MATERIALS, {
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
      setIsProcessing(false);
    },
    onError: (error) => {
      console.error('Error removing ads from LCD:', error);
      setIsProcessing(false);
      alert(`Error removing ad: ${error.message}`);
    }
  });

  const [createDeployment] = useMutation(CREATE_DEPLOYMENT, {
    onCompleted: () => {
      // Store device names before clearing the confirmation state
      const sourceDevice = moveConfirmation.sourceDeviceName;
      const targetDevice = moveConfirmation.targetDeviceName;
      
      refetchDeployments();
      setIsProcessing(false);
      setMoveConfirmation({
        isOpen: false,
        slot: null,
        sourceMaterialId: '',
        sourceDeviceName: '',
        targetMaterialId: '',
        targetDeviceName: '',
        sourceSlots: 0,
        targetSlots: 0
      });
      // Show success message
      setSuccessModal({
        isOpen: true,
        message: `Ad successfully moved from ${sourceDevice} to ${targetDevice}!`
      });
    },
    onError: (error) => {
      console.error('Error creating deployment:', error);
      setIsProcessing(false);
      // Even if there's an error, refetch to check if the operation actually succeeded
      // (sometimes GraphQL parsing errors occur but the backend operation succeeds)
      refetchDeployments();
      
      // Show error in modal instead of alert
      const errorMessage = error.message || 'Unknown error occurred';
      setErrorModal({
        isOpen: true,
        message: errorMessage.includes('ID cannot represent value') 
          ? 'There was an issue with the ad data format, but the ad may have been moved successfully. Please refresh to verify.'
          : `Error moving ad: ${errorMessage}`
      });
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

  // Toggle edit mode for a specific deployment
  const toggleEditMode = (deploymentId: string) => {
    setEditModeDeployments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(deploymentId)) {
        newSet.delete(deploymentId);
        // Clear dragged slot when exiting edit mode
        if (draggedSlot && draggedSlot.sourceDeploymentId === deploymentId) {
          setDraggedSlot(null);
        }
      } else {
        newSet.add(deploymentId);
      }
      return newSet;
    });
  };

  // Cancel move operation
  const handleCancelMove = () => {
    setDraggedSlot(null);
  };

  // Check if a deployment is in edit mode
  const isEditMode = (deploymentId: string) => {
    return editModeDeployments.has(deploymentId);
  };

  // Get Material _id from materialId string
  const getMaterialIdFromString = (materialIdString: string): string | null => {
    const materials = materialsData?.getAllMaterials || [];
    const material = materials.find((m: any) => m.materialId === materialIdString);
    return material?.id || null;
  };

  // Get available slots count for a deployment
  const getAvailableSlots = (deployment: AdDeployment): number => {
    const activeSlots = deployment.lcdSlots?.filter(slot => 
      ['SCHEDULED', 'RUNNING'].includes(slot.status)
    ).length || 0;
    return 5 - activeSlots;
  };

  // Handle delete icon click
  const handleDeleteClick = (slot: LCDSlot, materialId: string, adName: string) => {
    setDeleteConfirmation({
      isOpen: true,
      slot,
      materialId,
      adName
    });
  };

  // Confirm delete
  const handleConfirmDelete = async () => {
    if (!deleteConfirmation.slot || !deleteConfirmation.materialId) return;
    
    setIsProcessing(true);
    try {
      // Extract adId - handle both string and populated object cases
      const slot = deleteConfirmation.slot;
      let adId: string;
      if (typeof slot.adId === 'string') {
        adId = slot.adId;
      } else if (slot.adId && typeof slot.adId === 'object') {
        adId = (slot.adId as any)._id || (slot.adId as any).id || String(slot.adId);
      } else if (slot.ad?.id) {
        adId = slot.ad.id;
      } else {
        alert('Error: Could not determine ad ID');
        setIsProcessing(false);
        return;
      }

      await removeAdsFromLCD({
        variables: {
          materialId: deleteConfirmation.materialId,
          adIds: [adId],
          reason: 'Admin removed ad from device'
        }
      });
      setDeleteConfirmation({ isOpen: false, slot: null, materialId: '', adName: '' });
    } catch (error) {
      console.error('Error deleting ad:', error);
    }
  };

  // Handle move icon click - make slot draggable
  const handleMoveClick = (slot: LCDSlot, materialId: string, deploymentId: string) => {
    setDraggedSlot({
      slot,
      sourceMaterialId: materialId,
      sourceDeploymentId: deploymentId
    });
  };

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, slot: LCDSlot, materialId: string, deploymentId: string) => {
    if (!draggedSlot || draggedSlot.slot.id !== slot.id) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', ''); // Required for Firefox
  };

  const handleDragOver = (e: React.DragEvent, targetDeploymentId: string, targetMaterialId: string) => {
    e.preventDefault();
    if (!draggedSlot) return;

    // Don't allow drop on same device
    if (draggedSlot.sourceDeploymentId === targetDeploymentId) {
      e.dataTransfer.dropEffect = 'none';
      return;
    }

    // Check if target has available slots
    const targetDeployment = filteredDeployments.find((d: AdDeployment) => d.id === targetDeploymentId);
    if (!targetDeployment) {
      e.dataTransfer.dropEffect = 'none';
      return;
    }

    const availableSlots = getAvailableSlots(targetDeployment);
    if (availableSlots <= 0) {
      e.dataTransfer.dropEffect = 'none';
      return;
    }

    e.dataTransfer.dropEffect = 'move';
    setDragOverDeployment(targetDeploymentId);
  };

  const handleDragLeave = () => {
    setDragOverDeployment(null);
  };

  const handleDrop = (e: React.DragEvent, targetDeployment: AdDeployment) => {
    e.preventDefault();
    setDragOverDeployment(null);

    if (!draggedSlot) return;

    // Don't allow drop on same device
    if (draggedSlot.sourceDeploymentId === targetDeployment.id) {
      setDraggedSlot(null);
      return;
    }

    // Check if target has available slots
    const availableSlots = getAvailableSlots(targetDeployment);
    if (availableSlots <= 0) {
      alert('Target device is full (5/5 slots). Cannot move ad.');
      setDraggedSlot(null);
      return;
    }

    // Get source deployment for display
    const sourceDeployment = filteredDeployments.find((d: AdDeployment) => d.id === draggedSlot.sourceDeploymentId);
    const sourceSlots = sourceDeployment?.lcdSlots?.filter((s: LCDSlot) => 
      ['SCHEDULED', 'RUNNING'].includes(s.status)
    ).length || 0;
    const targetSlots = targetDeployment.lcdSlots?.filter((s: LCDSlot) => 
      ['SCHEDULED', 'RUNNING'].includes(s.status)
    ).length || 0;

    // Show confirmation dialog
    setMoveConfirmation({
      isOpen: true,
      slot: draggedSlot.slot,
      sourceMaterialId: draggedSlot.sourceMaterialId,
      sourceDeviceName: sourceDeployment?.materialId || 'Unknown Device',
      targetMaterialId: targetDeployment.materialId || '',
      targetDeviceName: targetDeployment.materialId || 'Unknown Device',
      sourceSlots,
      targetSlots
    });

    setDraggedSlot(null);
  };

  // Confirm move
  const handleConfirmMove = async () => {
    if (!moveConfirmation.slot || !moveConfirmation.sourceMaterialId || !moveConfirmation.targetMaterialId) return;

    setIsProcessing(true);

    try {
      // Get target deployment to find driverId
      // Use the string materialId directly (e.g., "DGL-HEADDRESS-CAR-003")
      const targetDeployment = filteredDeployments.find((d: AdDeployment) => 
        d.materialId === moveConfirmation.targetMaterialId
      );
      if (!targetDeployment || !targetDeployment.driverId) {
        alert('Error: Target device does not have a driver assigned');
        setIsProcessing(false);
        return;
      }

      const slot = moveConfirmation.slot;
      const startTime = slot.startTime || new Date().toISOString();
      const endTime = slot.endTime || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      // Extract adId - handle both string and populated object cases
      let adId: string;
      if (typeof slot.adId === 'string') {
        adId = slot.adId;
      } else if (slot.adId && typeof slot.adId === 'object') {
        // If adId is populated as an object, extract the ID
        // Try _id first (MongoDB format), then id, then string conversion
        const adIdObj = slot.adId as any;
        adId = adIdObj._id?.toString() || adIdObj.id?.toString() || (typeof adIdObj.toString === 'function' ? adIdObj.toString() : String(adIdObj));
        
        // If still an object, try to get the _id from the nested object
        if (typeof adId === 'object' || !adId || adId === '[object Object]') {
          // Last resort: try to get from ad.id
          if (slot.ad?.id) {
            adId = slot.ad.id;
          } else {
            console.error('Failed to extract adId from slot:', slot);
            throw new Error('Could not determine ad ID from slot. Please refresh and try again.');
          }
        }
      } else if (slot.ad?.id) {
        // Fallback to ad.id if available
        adId = slot.ad.id;
      } else {
        console.error('Slot data:', slot);
        throw new Error('Could not determine ad ID from slot. Please refresh and try again.');
      }
      
      // Ensure adId is a string
      if (typeof adId !== 'string' || !adId) {
        console.error('Invalid adId extracted:', adId, 'from slot:', slot);
        throw new Error('Invalid ad ID format. Please refresh and try again.');
      }
      
      console.log('Extracted adId for move:', adId);

      // Step 1: Remove from source device
      await removeAdsFromLCD({
        variables: {
          materialId: moveConfirmation.sourceMaterialId,
          adIds: [adId],
          reason: `Moved to ${moveConfirmation.targetDeviceName}`
        }
      });

      // Step 2: Add to target device
      // Pass the string materialId directly (backend expects string, not ObjectId)
      await createDeployment({
        variables: {
          input: {
            adId: adId,
            materialId: moveConfirmation.targetMaterialId,
            driverId: targetDeployment.driverId,
            startTime,
            endTime
          }
        }
      });

      // Note: onCompleted will handle closing the modal and refetching
    } catch (error: any) {
      console.error('Error moving ad:', error);
      setIsProcessing(false);
      
      // Refetch to check if operation actually succeeded despite the error
      refetchDeployments();
      
      // Show error in modal instead of alert
      const errorMessage = error.message || 'Unknown error occurred';
      setErrorModal({
        isOpen: true,
        message: errorMessage.includes('ID cannot represent value')
          ? 'There was an issue with the ad data format, but the ad may have been moved successfully. Please refresh to verify.'
          : `Error moving ad: ${errorMessage}`
      });
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
      <div className={`${isMobile ? 'p-4' : 'p-6'}`}>
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center space-x-2">
            <div className={`${isMobile ? 'w-6 h-6 border-2' : 'w-8 h-8 border-4'} border-blue-500 border-t-transparent rounded-full animate-spin`}></div>
            <span className={`${isMobile ? 'text-sm' : 'text-lg'} text-gray-600`}>Loading deployments...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Deployment Stats */}
      <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-5'} gap-4 mb-6`}>
        <div className={`bg-white ${isMobile ? 'p-3' : 'p-4'} rounded-lg shadow`}>
          <p className={`${isMobile ? 'text-2xl' : 'text-3xl'} text-center font-bold text-blue-600`}>
            {deploymentsData?.getAllDeployments?.length || 0}
          </p>
          <h3 className={`${isMobile ? 'text-xs' : 'text-sm'} text-center font-medium text-gray-500`}>Total Devices</h3>
          <p className="text-xs text-center text-gray-400 mt-1">with deployments</p>
        </div>
        <div className={`bg-white ${isMobile ? 'p-3' : 'p-4'} rounded-lg shadow`}>
          <p className={`${isMobile ? 'text-2xl' : 'text-3xl'} text-center font-bold text-green-600`}>
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
          <h3 className={`${isMobile ? 'text-xs' : 'text-sm'} text-center font-medium text-gray-500`}>Running Ads</h3>
          <p className="text-xs text-center text-gray-400 mt-1">actively playing</p>
        </div>
        <div className={`bg-white ${isMobile ? 'p-3' : 'p-4'} rounded-lg shadow`}>
          <p className={`${isMobile ? 'text-2xl' : 'text-3xl'} text-center font-bold text-purple-600`}>
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
          <h3 className={`${isMobile ? 'text-xs' : 'text-sm'} text-center font-medium text-gray-500`}>Scheduled Ads</h3>
          <p className="text-xs text-center text-gray-400 mt-1">waiting to start</p>
        </div>
        <div className={`bg-white ${isMobile ? 'p-3' : 'p-4'} rounded-lg shadow`}>
          <p className={`${isMobile ? 'text-2xl' : 'text-3xl'} text-center font-bold text-gray-600`}>
            {(() => {
              // Total slots = number of devices × 5 slots per device
              const totalDevices = deploymentsData?.getAllDeployments?.length || 0;
              return totalDevices * 5;
            })()}
          </p>
          <h3 className={`${isMobile ? 'text-xs' : 'text-sm'} text-center font-medium text-gray-500`}>Total Slots</h3>
          <p className="text-xs text-center text-gray-400 mt-1">all device slots</p>
        </div>
        <div className={`bg-white ${isMobile ? 'p-3' : 'p-4'} rounded-lg shadow`}>
          <p className={`${isMobile ? 'text-2xl' : 'text-3xl'} text-center font-bold text-orange-600`}>
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
          <h3 className={`${isMobile ? 'text-xs' : 'text-sm'} text-center font-medium text-gray-500`}>Available Slots</h3>
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
            <div 
              key={deployment.id} 
              className={`border rounded-lg ${isMobile ? 'p-4' : 'p-6'} bg-white shadow-sm hover:shadow-md transition-all ${
                dragOverDeployment === deployment.id 
                  ? 'border-blue-500 border-2 bg-blue-50' 
                  : 'border-gray-200'
              }`}
              onDragOver={(e) => handleDragOver(e, deployment.id, deployment.materialId || '')}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, deployment)}
            >
              {/* Header with Material ID and Status */}
              <div className={`flex ${isMobile ? 'flex-col gap-3' : 'justify-between items-start'} mb-4`}>
                <div className={`${isMobile ? 'w-full' : 'flex-1'}`}>
                  <div className={`flex ${isMobile ? 'flex-col gap-2 items-start' : 'items-center gap-3'} mb-2`}>
                    <h3 className={`${isMobile ? 'text-lg' : 'text-xl'} font-bold text-blue-700 break-words`}>
                      {deployment.materialId || 'Unknown Device'}
                    </h3>
                    {/* Deployment status - show RUNNING (finished ads are removed from slots) */}
                    <span className={`px-3 py-1 text-xs font-medium rounded-full bg-green-200 text-green-800 ${isMobile ? 'self-start' : ''}`}>
                      RUNNING
                    </span>
                  </div>
                  
                  {/* Deployment ID */}
                  <div className={`${isMobile ? 'text-xs' : 'text-sm'} text-gray-600 mb-1 break-words`}>
                    <span className="font-medium">Deployment ID:</span> <span className={`font-mono ${isMobile ? 'text-xs' : 'text-xs'}`}>{deployment.adDeploymentId || deployment.id}</span>
                  </div>
                  
                  {/* Driver ID */}
                  <div className={`${isMobile ? 'text-xs' : 'text-sm'} text-gray-600 break-words`}>
                    <span className="font-medium">Driver:</span> <span className={`font-mono ${isMobile ? 'text-xs' : 'text-xs'}`}>{deployment.driverId || 'Not assigned'}</span>
                  </div>
                </div>
              </div>

              {/* Deployment Metadata */}
              <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-2 md:grid-cols-4'} gap-3 mb-4 text-xs`}>
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
                    {deployment.lcdSlots?.filter(s => s.status !== 'REMOVED').length || 0}
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
              {deployment.lcdSlots && deployment.lcdSlots.filter(s => s.status !== 'REMOVED').length > 0 && (
                <div className="mt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <button
                      onClick={() => toggleEditMode(deployment.id)}
                      className={`p-1 rounded hover:bg-gray-100 transition-colors ${
                        isEditMode(deployment.id) ? 'bg-blue-100 text-blue-600' : 'text-gray-600'
                      }`}
                      title={isEditMode(deployment.id) ? 'Exit edit mode' : 'Edit slots'}
                    >
                      <Settings className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'}`} />
                    </button>
                    <h4 className={`${isMobile ? 'text-xs' : 'text-sm'} font-medium text-gray-700`}>Ad Slots ({deployment.lcdSlots.filter(s => s.status !== 'REMOVED').length})</h4>
                  </div>
                  <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'} gap-3`}>
                    {deployment.lcdSlots
                      .filter((slot: LCDSlot) => slot.status !== 'REMOVED') // Filter out REMOVED slots - they're not active
                      .map((slot: LCDSlot, index: number) => {
                      const isDraggable = draggedSlot?.slot.id === slot.id;
                      const isDragging = draggedSlot !== null && draggedSlot.slot.id === slot.id;
                      return (
                      <div 
                        key={slot.id || index} 
                        className={`bg-gray-50 border rounded-lg ${isMobile ? 'p-2' : 'p-3'} transition-all ${
                          isDragging 
                            ? 'border-blue-500 border-2 opacity-50 cursor-move' 
                            : isDraggable
                            ? 'border-blue-300 border-2 cursor-move hover:shadow-md'
                            : 'border-gray-200'
                        }`}
                        draggable={isDraggable}
                        onDragStart={(e) => handleDragStart(e, slot, deployment.materialId || '', deployment.id)}
                        style={isDraggable ? { cursor: 'move' } : {}}
                      >
                        <div className={`flex items-center ${isMobile ? 'flex-col gap-2 items-start' : 'justify-between'} mb-2`}>
                          <div className="flex items-center gap-2">
                            <span className={`${isMobile ? 'text-xs' : 'text-sm'} font-medium text-gray-800`}>Slot {slot.slotNumber}</span>
                            {isEditMode(deployment.id) && (
                              <div className="flex gap-1">
                                {!isDraggable && (
                                  <>
                                    {/* Show delete icon for active slots */}
                                    {['SCHEDULED', 'RUNNING'].includes(slot.status) && (
                                      <button
                                        onClick={() => handleDeleteClick(slot, deployment.materialId || '', slot.ad?.title || 'Unknown Ad')}
                                        className="p-1 rounded hover:bg-red-100 text-red-600 transition-colors"
                                        title="Delete ad"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    )}
                                    {/* Show move icon only for active slots (SCHEDULED or RUNNING) */}
                                    {['SCHEDULED', 'RUNNING'].includes(slot.status) && (
                                      <button
                                        onClick={() => handleMoveClick(slot, deployment.materialId || '', deployment.id)}
                                        className="p-1 rounded hover:bg-blue-100 text-blue-600 transition-colors"
                                        title="Move ad to another device"
                                      >
                                        <Move className="w-3 h-3" />
                                      </button>
                                    )}
                                  </>
                                )}
                                {isDraggable && (
                                  <button
                                    onClick={handleCancelMove}
                                    className="p-1 rounded hover:bg-gray-100 text-gray-600 transition-colors"
                                    title="Cancel move"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                          <div className={`flex gap-1 flex-wrap ${isMobile ? 'justify-start' : 'justify-end'}`}>
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
                              
                              if (isEnded || slot.status === 'COMPLETED') {
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
                        {isDraggable && (
                          <p className="text-xs text-blue-600 font-medium mt-2">
                            Drag to another device to move
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
                    );
                    })}
                  </div>
                </div>
              )}

            </div>
          ))}

          {/* Pagination Controls */}
          {filteredDeployments.length > 0 && (
            <div className={`flex items-center justify-center ${isMobile ? 'px-2 py-3' : 'px-4 py-4'} mt-4`}>
              <div className={`flex ${isMobile ? 'flex-col gap-2 w-full' : 'items-center gap-2'}`}>
                <div className={`flex ${isMobile ? 'justify-between w-full' : 'items-center gap-2'}`}>
                  <button
                    onClick={handlePreviousPage}
                    disabled={currentPage === 1}
                    className={`flex items-center ${isMobile ? 'px-2 py-1 text-xs' : 'px-3 py-1 text-sm'} rounded font-semibold hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <ChevronLeft className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'} ${isMobile ? '' : 'mr-1'}`} />
                    {!isMobile && <span>Previous</span>}
                  </button>

                  <div className={`flex gap-1 ${isMobile ? 'overflow-x-auto' : ''}`}>
                    {(() => {
                      const pages = [];
                      const maxVisiblePages = isMobile ? 3 : 5;
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
                            className={`${isMobile ? 'px-2 py-1 text-xs' : 'px-3 py-1 text-sm'} rounded ${
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
                          <span key="ellipsis" className={`${isMobile ? 'px-1' : 'px-2'} text-gray-500`}>
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
                    className={`flex items-center ${isMobile ? 'px-2 py-1 text-xs' : 'px-3 py-1 text-sm'} rounded font-semibold hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {!isMobile && <span>Next</span>}
                    <ChevronRight className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'} ${isMobile ? '' : 'ml-1'}`} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteConfirmation.isOpen}
        onClose={() => setDeleteConfirmation({ isOpen: false, slot: null, materialId: '', adName: '' })}
        onConfirm={handleConfirmDelete}
        title="Delete Ad"
        message={`Are you sure you want to remove "${deleteConfirmation.adName}" from ${deleteConfirmation.materialId || 'this device'}? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        confirmButtonClass="bg-red-600 hover:bg-red-700"
        isProcessing={isProcessing}
      />

      {/* Move Confirmation Modal */}
      <ConfirmationModal
        isOpen={moveConfirmation.isOpen}
        onClose={() => setMoveConfirmation({
          isOpen: false,
          slot: null,
          sourceMaterialId: '',
          sourceDeviceName: '',
          targetMaterialId: '',
          targetDeviceName: '',
          sourceSlots: 0,
          targetSlots: 0
        })}
        onConfirm={handleConfirmMove}
        title="Move Ad to Another Device"
        message={`Are you sure you want to move "${moveConfirmation.slot?.ad?.title || 'this ad'}"?\n\nFrom: ${moveConfirmation.sourceDeviceName} (${moveConfirmation.sourceSlots}/5 → ${moveConfirmation.sourceSlots - 1}/5)\nTo: ${moveConfirmation.targetDeviceName} (${moveConfirmation.targetSlots}/5 → ${moveConfirmation.targetSlots + 1}/5)`}
        confirmText="Move"
        cancelText="Cancel"
        confirmButtonClass="bg-blue-600 hover:bg-blue-700"
        isProcessing={isProcessing}
      />

      {/* Error Modal */}
      <ConfirmationModal
        isOpen={errorModal.isOpen}
        onClose={() => setErrorModal({ isOpen: false, message: '' })}
        onConfirm={() => {
          setErrorModal({ isOpen: false, message: '' });
          refetchDeployments(); // Refetch after closing error modal
        }}
        title="Error"
        message={errorModal.message}
        confirmText="OK"
        cancelText=""
        confirmButtonClass="bg-red-600 hover:bg-red-700"
        isProcessing={false}
      />

      {/* Success Modal */}
      <ConfirmationModal
        isOpen={successModal.isOpen}
        onClose={() => setSuccessModal({ isOpen: false, message: '' })}
        onConfirm={() => {
          setSuccessModal({ isOpen: false, message: '' });
        }}
        title="Success"
        message={successModal.message}
        confirmText="OK"
        cancelText=""
        confirmButtonClass="bg-green-600 hover:bg-green-700"
        isProcessing={false}
      />
    </div>
  );
};

export default DeploymentTab;
