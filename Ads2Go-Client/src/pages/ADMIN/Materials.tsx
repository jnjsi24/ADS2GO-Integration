import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { Trash, ChevronLeft, ChevronRight, Pencil, Archive, RotateCcw, X, Plus } from 'lucide-react';
import { 
  GET_ALL_MATERIALS, 
  GET_TABLETS_BY_MATERIAL, 
  GET_TABLET_CONNECTION_STATUS, 
  GET_DRIVERS_FOR_MATERIALS 
} from '../../graphql/admin/queries/materials';
import { 
  CREATE_MATERIAL, 
  DELETE_MATERIAL, 
  RESTORE_MATERIAL,
  ASSIGN_MATERIAL_TO_DRIVER, 
  UPDATE_MATERIAL, 
  UNREGISTER_TABLET, 
  CREATE_TABLET_CONFIGURATION,
  UNASSIGN_MATERIAL_FROM_DRIVER
} from '../../graphql/admin/mutations/materials';
import CreateMaterialModal from './tabs/materials/CreateMaterialModal';
import MaterialDetailsModal from './tabs/materials/MaterialDetailsModal';
import TabletConnectionModal from './tabs/materials/TabletConnectionModal';
import ConfirmationModal from '../../components/ConfirmationModal';
import DriverAssignmentModal from './tabs/materials/DriverAssignmentModal';
import MaterialFilters from './tabs/materials/MaterialFilters';
import { ToastContainer, useToast } from '../../components/ToastNotification';
import { AdminLoader } from '../../components/ProtectedRoute';

interface Driver {
  driverId: string;
  fullName: string;
  email: string;
  contactNumber: string;
  vehiclePlateNumber: string;
}

interface DriverWithVehicleType extends Driver {
  vehicleType: 'CAR' | 'MOTORCYCLE' | 'BUS' | 'JEEP' | 'E_TRIKE';
  preferredMaterialType?: ('POSTER' | 'LCD' | 'STICKER' | 'HEADDRESS' | 'BANNER')[];
}

interface InspectionPhoto {
  url: string;
  uploadedAt: string;
  uploadedBy: string;
  description?: string;
  month: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

interface Material {
  id: string;
  materialId: string;
  vehicleType: 'CAR' | 'MOTORCYCLE' | 'BUS' | 'JEEP' | 'E_TRIKE';
  materialType: 'POSTER' | 'LCD' | 'STICKER' | 'HEADDRESS' | 'BANNER';
  description?: string;
  requirements: string;
  category: 'DIGITAL' | 'NON_DIGITAL';
  driverId?: string;
  driver?: Driver;
  assignedDate?: string;
  mountedAt?: string;
  dismountedAt?: string;
  createdAt: string;
  updatedAt: string;
  // Material condition and inspection fields
  materialCondition?: 'GOOD' | 'FADED' | 'DAMAGED' | 'REMOVED';
  inspectionPhotos?: InspectionPhoto[];
  photoComplianceStatus?: 'COMPLIANT' | 'NON_COMPLIANT' | 'PENDING';
  lastInspectionDate?: string;
  nextInspectionDue?: string;
  // Archive fields
  isArchived?: boolean;
  archivedAt?: string | null;
  scheduledDeletionDate?: string | null;
}

interface CreateMaterialInput {
  vehicleType: 'CAR' | 'MOTORCYCLE' | 'BUS' | 'JEEP' | 'E_TRIKE';
  materialType: 'POSTER' | 'LCD' | 'STICKER' | 'HEADDRESS' | 'BANNER';
  description: string;
  requirements: string;
  category: 'DIGITAL' | 'NON_DIGITAL';
}

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

interface ConnectionDetails {
  materialId: string;
  slotNumber: number;
  carGroupId: string;
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


const Materials: React.FC = () => {
  const { toasts, addToast, removeToast } = useToast();
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
  const [selectedType, setSelectedType] = useState<'All' | 'POSTER' | 'LCD' | 'STICKER' | 'HEADDRESS' | 'BANNER'>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Used' | 'Available'>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('Newest First');
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedMaterialDetails, setSelectedMaterialDetails] = useState<Material | null>(null);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [materialToRestore, setMaterialToRestore] = useState<string | null>(null);

  // State for date editing
  const [editingDates, setEditingDates] = useState<{[key: string]: {mountedAt: string, dismountedAt: string}}>({});
  const [savingDates, setSavingDates] = useState<{[key: string]: boolean}>({});
  
  // State for manual assignment
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedMaterialForAssign, setSelectedMaterialForAssign] = useState<Material | null>(null);

  // State for Tablet interface and connection details
  const [showTabletInterface, setShowTabletInterface] = useState(false);
  const [selectedTabletMaterialId, setSelectedTabletMaterialId] = useState<string | null>(null);
  const [selectedTabletSlotNumber, setSelectedTabletSlotNumber] = useState<number | null>(null);
      // Store the material that was open when opening slot modal, so we can restore it when closing
  const [materialBeforeSlotModal, setMaterialBeforeSlotModal] = useState<Material | null>(null);
  const [unregistering, setUnregistering] = useState(false);
  const [creatingTabletConfig, setCreatingTabletConfig] = useState(false);
  const [refreshingConnectionStatus, setRefreshingConnectionStatus] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [materialToDelete, setMaterialToDelete] = useState<string | null>(null);
  const [showCreateTabletModal, setShowCreateTabletModal] = useState(false);
  const [showUnregisterTabletModal, setShowUnregisterTabletModal] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [materialToRemove, setMaterialToRemove] = useState<string | null>(null);
  const [dismountReason, setDismountReason] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  
  // Bulk actions state
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showBulkAssignModal, setShowBulkAssignModal] = useState(false);
  const [bulkSelectedDriver, setBulkSelectedDriver] = useState('');
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(9);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setIsMobile(width < 768);
      setSidebarCollapsed(width >= 768 && width < 1024);
      setItemsPerPage(width < 768 ? 5 : 9);
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Custom refresh function for connection status
  const handleRefetchConnectionStatus = async () => {
    if (refreshingConnectionStatus) return; // Prevent multiple simultaneous refreshes
    
    setRefreshingConnectionStatus(true);
    try {
      await refetchConnectionStatus();
    } catch (error) {
      console.error('Error refreshing connection status:', error);
    } finally {
      setRefreshingConnectionStatus(false);
    }
  };

  // GraphQL hooks
  const { data, loading, error, refetch } = useQuery(GET_ALL_MATERIALS, {
    context: {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    },
    errorPolicy: 'all',
  });

  // Handle data loading with useEffect instead of onCompleted
  useEffect(() => {
    if (data) {
      console.log('Materials data loaded:', data);
    }
  }, [data]);

  // Handle errors with useEffect instead of onError
  useEffect(() => {
    if (error) {
      console.error('Error loading materials:', error);
    }
  }, [error]);

  const { data: driversData, loading: driversLoading, error: driversError } = useQuery(GET_DRIVERS_FOR_MATERIALS, {
    context: {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    },
    errorPolicy: 'all',
  });

  // Handle drivers errors with useEffect instead of onError
  useEffect(() => {
    if (driversError) {
      console.error('Error loading drivers:', driversError);
    }
  }, [driversError]);

  const [createMaterial, { loading: creating }] = useMutation(CREATE_MATERIAL, {
    context: {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    },
    onCompleted: () => {
      addToast({
        type: 'success',
        title: 'Success!',
        message: 'Device added successfully.',
        duration: 4000
      });
      setShowCreateModal(false);
      refetch();
    },
    onError: (error) => {
      addToast({
        type: 'error',
        title: 'Error!',
        message: `Error creating device: ${error.message}`,
        duration: 5000
      });
    }
  });

  const [deleteMaterial] = useMutation(DELETE_MATERIAL, {
    context: {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    },
    onCompleted: () => {
      addToast({
        type: 'success',
        title: 'Success!',
        message: 'Device deleted successfully.',
        duration: 4000
      });
      refetch();
    },
    onError: (error) => {
      addToast({
        type: 'error',
        title: 'Error!',
        message: `Error deleting device: ${error.message}`,
        duration: 5000
      });
    }
  });

  const [restoreMaterial] = useMutation(RESTORE_MATERIAL, {
    context: {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    },
    onCompleted: () => {
      addToast({
        type: 'success',
        title: 'Success!',
        message: 'Device restored successfully.',
        duration: 4000
      });
      refetch();
    },
    onError: (error) => {
      addToast({
        type: 'error',
        title: 'Error!',
        message: `Error restoring material: ${error.message}`,
        duration: 5000
      });
    }
  });

  // Tablet query hook
  const { data: tabletData, loading: tabletLoading, error: tabletError, refetch: refetchTabletData } = useQuery(GET_TABLETS_BY_MATERIAL, {
    variables: { materialId: selectedTabletMaterialId || '' },
    pollInterval: 30000, // ✅ OPTIMIZATION: Refresh every 30 seconds (increased from 5s) - reduces queries by 84%
    context: {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    },
    skip: !selectedTabletMaterialId,
    errorPolicy: 'all',
    fetchPolicy: 'cache-and-network',
  });

  // Handle tablet data loading with useEffect instead of onCompleted
  useEffect(() => {
    if (tabletData) {
      console.log('Tablet query completed:', { materialId: selectedTabletMaterialId, data: tabletData });
    }
  }, [tabletData, selectedTabletMaterialId]);

  // Handle tablet errors with useEffect instead of onError
  useEffect(() => {
    if (tabletError) {
      console.error('Error loading tablets:', tabletError);
    }
  }, [tabletError]);

  // Tablet connection status query hook
  const { data: connectionStatusData, loading: connectionStatusLoading, error: connectionStatusError, refetch: refetchConnectionStatus } = useQuery(GET_TABLET_CONNECTION_STATUS, {
    variables: { 
      materialId: selectedTabletMaterialId || '', 
      slotNumber: selectedTabletSlotNumber || 1 
    },
    pollInterval: 30000, // ✅ OPTIMIZATION: Refresh every 30 seconds (increased from 5s) - reduces queries by 84%
    context: {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    },
    skip: !selectedTabletMaterialId || !selectedTabletSlotNumber,
    errorPolicy: 'all',
    fetchPolicy: 'cache-and-network',
  });

  // Handle connection status data loading with useEffect instead of onCompleted
  useEffect(() => {
    if (connectionStatusData) {
      console.log('Connection status query completed:', { materialId: selectedTabletMaterialId, slotNumber: selectedTabletSlotNumber, data: connectionStatusData });
    }
  }, [connectionStatusData, selectedTabletMaterialId, selectedTabletSlotNumber]);

  // Handle connection status errors with useEffect instead of onError
  useEffect(() => {
    if (connectionStatusError) {
      console.error('Error loading tablet connection status:', connectionStatusError);
    }
  }, [connectionStatusError]);

  // Get connection status for both slots of a material
  const getSlotConnectionStatus = (materialId: string, slotNumber: number) => {
    // This is a simplified approach - in a real implementation, you might want to cache this data
    // For now, we'll use the existing tablet data to determine connection status
    const tabletData = data?.getAllMaterials?.find((m: any) => m.id === materialId);
    if (!tabletData) return null;
    
    // This would need to be enhanced with actual connection status data
    return null;
  };



  // Function to copy connection details to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      addToast({
        type: 'success',
        title: 'Copied!',
        message: 'Connection details copied to clipboard.',
        duration: 3000
      });
    }).catch(() => {
      addToast({
        type: 'error',
        title: 'Error!',
        message: 'Failed to copy to clipboard. Please try again.',
        duration: 4000
      });
    });
  };

  // Function to show connection details modal
  const showConnectionDetails = (materialId: string, slotNumber: number) => {
    console.log('Opening connection details for:', { materialId, slotNumber });
    // Store the current material so we can restore it when closing the slot modal
    if (selectedMaterialDetails) {
      setMaterialBeforeSlotModal(selectedMaterialDetails);
    } else {
      // If material details modal wasn't open, find the material from the list
      const material = materials.find(m => m.materialId === materialId);
      if (material) {
        setMaterialBeforeSlotModal(material);
      }
    }
    // Close Material Details modal first to prevent overlap
    setShowDetailsModal(false);
    setSelectedMaterialDetails(null);
    // Small delay to ensure modal closes before opening new one
    setTimeout(() => {
      setSelectedTabletMaterialId(materialId);
      setSelectedTabletSlotNumber(slotNumber);
      setShowTabletInterface(true);
    }, 100);
  };

  // Function to create tablet configuration
  const handleCreateTabletConfiguration = async () => {
    if (!selectedTabletMaterialId) {
      addToast({
        type: 'error',
        title: 'Error!',
        message: 'Missing material ID',
        duration: 4000
      });
      return;
    }

    setShowCreateTabletModal(true);
  };

  const confirmCreateTablet = async () => {
    if (!selectedTabletMaterialId) return;

    setCreatingTabletConfig(true);
    try {
      // Generate a car group ID based on the material ID
      const carGroupId = `GRP-${selectedTabletMaterialId.replace(/[^A-Z0-9]/g, '')}-${Date.now().toString(16).toUpperCase()}`;
      
      await createTabletConfiguration({
        variables: {
          input: {
            materialId: selectedTabletMaterialId,
            carGroupId
          }
        }
      });
    } catch (error) {
      console.error('Error creating tablet configuration:', error);
    } finally {
      setCreatingTabletConfig(false);
      setShowCreateTabletModal(false);
    }
  };

  const cancelCreateTablet = () => {
    setShowCreateTabletModal(false);
  };

  // Function to unregister tablet
  const handleUnregisterTablet = async () => {
    if (!selectedTabletMaterialId || !selectedTabletSlotNumber || !tabletData?.getTabletsByMaterial?.[0]?.carGroupId) {
      addToast({
        type: 'error',
        title: 'Error!',
        message: 'Missing required information for unregistration',
        duration: 4000
      });
      return;
    }

    setShowUnregisterTabletModal(true);
  };

  const confirmUnregisterTablet = async () => {
    if (!selectedTabletMaterialId || !selectedTabletSlotNumber || !tabletData?.getTabletsByMaterial?.[0]?.carGroupId) {
      return;
    }

    setUnregistering(true);
    try {
      await unregisterTablet({
        variables: {
          input: {
            materialId: selectedTabletMaterialId,
            slotNumber: selectedTabletSlotNumber,
            carGroupId: tabletData.getTabletsByMaterial[0].carGroupId
          }
        }
      });
    } catch (error) {
      console.error('Error unregistering tablet:', error);
    } finally {
      setUnregistering(false);
      setShowUnregisterTabletModal(false);
    }
  };

  const cancelUnregisterTablet = () => {
    setShowUnregisterTabletModal(false);
  };

  const [updateMaterial] = useMutation(UPDATE_MATERIAL, {
    context: {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    },
    onCompleted: async () => {
      addToast({
        type: 'success',
        title: 'Success!',
        message: 'Material updated successfully.',
        duration: 4000
      });
      
      // Refetch and update the selected material details with fresh data
      const result = await refetch();
      if (selectedMaterialDetails && result.data) {
        const updatedMaterial = result.data.getAllMaterials.find(
          (m: Material) => m.id === selectedMaterialDetails.id
        );
        if (updatedMaterial) {
          setSelectedMaterialDetails(updatedMaterial);
        }
      }
    },
    onError: (error) => {
      addToast({
        type: 'error',
        title: 'Error!',
        message: `Error updating material: ${error.message}`,
        duration: 5000
      });
    }
  });

  const [assignMaterialToDriver, { loading: assigning }] = useMutation(ASSIGN_MATERIAL_TO_DRIVER, {
    context: {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    },
    onCompleted: async (data) => {
      if (data.assignMaterialToDriver.success) {
        addToast({
          type: 'success',
          title: 'Success!',
          message: data.assignMaterialToDriver.message || 'Material assigned successfully.',
          duration: 4000
        });
        setShowAssignModal(false);
        setSelectedMaterialForAssign(null);
        
        // Refetch and update the selected material details with fresh data
        const result = await refetch();
        if (selectedMaterialDetails && result.data) {
          const updatedMaterial = result.data.getAllMaterials.find(
            (m: Material) => m.id === selectedMaterialDetails.id
          );
          if (updatedMaterial) {
            setSelectedMaterialDetails(updatedMaterial);
          }
        }
      } else {
        addToast({
          type: 'error',
          title: 'Assignment Failed',
          message: data.assignMaterialToDriver.message,
          duration: 5000
        });
      }
    },
    onError: (error) => {
      addToast({
        type: 'error',
        title: 'Error!',
        message: `Error assigning material: ${error.message}`,
        duration: 5000
      });
    }
  });

  const [unassignMaterialFromDriver, { loading: unassigning }] = useMutation(UNASSIGN_MATERIAL_FROM_DRIVER, {
    context: {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    },
    onCompleted: async (data) => {
      if (data.unassignMaterialFromDriver.success) {
        addToast({
          type: 'success',
          title: 'Success!',
          message: data.unassignMaterialFromDriver.message || 'Material unassigned successfully.',
          duration: 4000
        });
        setShowRemoveModal(false);
        setMaterialToRemove(null);
        setDismountReason('');
        
        // Refetch and update the selected material details with fresh data
        const result = await refetch();
        if (selectedMaterialDetails && result.data) {
          const updatedMaterial = result.data.getAllMaterials.find(
            (m: Material) => m.id === selectedMaterialDetails.id
          );
          if (updatedMaterial) {
            setSelectedMaterialDetails(updatedMaterial);
          }
        }
      } else {
        addToast({
          type: 'error',
          title: 'Unassignment Failed',
          message: data.unassignMaterialFromDriver.message,
          duration: 5000
        });
      }
    },
    onError: (error) => {
      addToast({
        type: 'error',
        title: 'Error!',
        message: `Error unassigning material: ${error.message}`,
        duration: 5000
      });
    }
  });

  const [unregisterTablet] = useMutation(UNREGISTER_TABLET, {
    context: {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    },
    onCompleted: (data) => {
      if (data.unregisterTablet.success) {
        addToast({
          type: 'success',
          title: 'Success!',
          message: data.unregisterTablet.message || 'Tablet unregistered successfully.',
          duration: 4000
        });
        refetchConnectionStatus();
      } else {
        addToast({
          type: 'error',
          title: 'Unregistration Failed',
          message: data.unregisterTablet.message,
          duration: 5000
        });
      }
      setUnregistering(false);
    },
    onError: (error) => {
      addToast({
        type: 'error',
        title: 'Error!',
        message: `Error unregistering tablet: ${error.message}`,
        duration: 5000
      });
      setUnregistering(false);
    }
  });

  const [createTabletConfiguration] = useMutation(CREATE_TABLET_CONFIGURATION, {
    context: {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    },
    onCompleted: (data) => {
      if (data.createTabletConfiguration.success) {
        addToast({
          type: 'success',
          title: 'Success!',
          message: data.createTabletConfiguration.message || 'Tablet configuration created successfully.',
          duration: 4000
        });
        // Refetch tablet data
        if (selectedTabletMaterialId) {
          // Refetch the tablet data
          refetch();
        }
      } else {
        addToast({
          type: 'error',
          title: 'Creation Failed',
          message: data.createTabletConfiguration.message,
          duration: 5000
        });
      }
      setCreatingTabletConfig(false);
    },
    onError: (error) => {
      addToast({
        type: 'error',
        title: 'Error!',
        message: `Error creating tablet configuration: ${error.message}`,
        duration: 5000
      });
      setCreatingTabletConfig(false);
    }
  });

  const materials: Material[] = data?.getAllMaterials || [];
  const drivers: DriverWithVehicleType[] = driversData?.getAllDrivers || [];

  // Debug logging
  useEffect(() => {
    if (materials.length > 0) {
      console.log('First material data:', materials[0]);
      console.log('Materials with drivers:', materials.filter(m => m.driver));
    }
  }, [materials]);


  // Helper function to determine status
  const getStatus = (material: Material): 'Used' | 'Available' => {
    return material.driverId ? 'Used' : 'Available';
  };

  // Helper function to extract numeric part from materialId
  const extractNumber = (materialId: string): number => {
    const match = materialId.match(/\d+$/);
    return match ? parseInt(match[0], 10) : 0;
  };

  // Filter and sort materials
  const filtered = materials.filter((material) => {
    // Filter by archive status based on active tab
    const isArchivedMatch = activeTab === 'archived' ? material.isArchived === true : material.isArchived !== true;
    
    if (!isArchivedMatch) return false;

    const typeMatch = selectedType === 'All' || material.materialType === selectedType;
    const searchMatch =
      material.materialId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      material.materialType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (material.description && material.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (material.requirements && material.requirements.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (material.driver?.fullName && material.driver.fullName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (material.driver?.vehiclePlateNumber && material.driver.vehiclePlateNumber.toLowerCase().includes(searchTerm.toLowerCase()));

    const status = getStatus(material);
    const statusMatch = statusFilter === 'All' || status === statusFilter;
    
    return typeMatch && searchMatch && statusMatch;
  }).sort((a, b) => {
    switch (sortBy) {
      case 'Newest First':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case 'Oldest First':
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      case 'ID: Low to High':
        return extractNumber(a.materialId) - extractNumber(b.materialId);
      case 'ID: High to Low':
        return extractNumber(b.materialId) - extractNumber(a.materialId);
      default:
        return 0;
    }
  });

  const handleMaterialSelect = (id: string) => {
    setSelectedMaterials(prevSelected =>
      prevSelected.includes(id)
        ? prevSelected.filter(materialId => materialId !== id)
        : [...prevSelected, id]
    );
  };

  const handleSelectAll = () => {
    const currentPageIds = paginatedMaterials.map(material => material.id);
    const allCurrentPageSelected = currentPageIds.every(id => selectedMaterials.includes(id));
    
    if (allCurrentPageSelected) {
      // Deselect only items from current page
      setSelectedMaterials(prev => prev.filter(id => !currentPageIds.includes(id)));
    } else {
      // Add current page items to existing selection
      setSelectedMaterials(prev => {
        const newSelection = [...prev];
        currentPageIds.forEach(id => {
          if (!newSelection.includes(id)) newSelection.push(id);
        });
        return newSelection;
      });
    }
  };

  // Bulk action handlers
  const handleBulkDelete = () => {
    if (selectedMaterials.length === 0) return;
    setShowBulkDeleteModal(true);
  };

  const confirmBulkDelete = async () => {
    setIsBulkProcessing(true);

    try {
      const results = await Promise.allSettled(
        selectedMaterials.map(id =>
          deleteMaterial({
            variables: { id }
          })
        )
      );

      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failCount = results.filter(r => r.status === 'rejected').length;

      if (successCount > 0) {
        addToast({
          type: 'success',
          title: 'Success!',
          message: `${successCount} material(s) deleted successfully${failCount > 0 ? ` (${failCount} failed)` : ''}`,
          duration: 5000
        });
      }

      if (failCount > 0 && successCount === 0) {
        addToast({
          type: 'error',
          title: 'Error!',
          message: `Failed to delete ${failCount} material(s)`,
          duration: 5000
        });
      }

      setShowBulkDeleteModal(false);
      setSelectedMaterials([]);
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Error!',
        message: 'Error deleting materials: ' + (err.message || 'Unknown error'),
        duration: 5000
      });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkAssign = () => {
    if (selectedMaterials.length === 0) return;
    setShowBulkAssignModal(true);
  };

  const confirmBulkAssign = async () => {
    if (!bulkSelectedDriver) {
      addToast({
        type: 'warning',
        title: 'Missing Information',
        message: 'Please select a driver',
        duration: 4000
      });
      return;
    }

    setIsBulkProcessing(true);

    try {
      const results = await Promise.allSettled(
        selectedMaterials.map(materialId =>
          assignMaterialToDriver({
            variables: { materialId, driverId: bulkSelectedDriver }
          })
        )
      );

      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failCount = results.filter(r => r.status === 'rejected').length;

      if (successCount > 0) {
        addToast({
          type: 'success',
          title: 'Success!',
          message: `${successCount} material(s) assigned successfully${failCount > 0 ? ` (${failCount} failed)` : ''}`,
          duration: 5000
        });
      }

      if (failCount > 0 && successCount === 0) {
        addToast({
          type: 'error',
          title: 'Error!',
          message: `Failed to assign ${failCount} material(s)`,
          duration: 5000
        });
      }

      setShowBulkAssignModal(false);
      setBulkSelectedDriver('');
      setSelectedMaterials([]);
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Error!',
        message: 'Error assigning materials: ' + (err.message || 'Unknown error'),
        duration: 5000
      });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleExportToCSV = () => {
    if (selectedMaterials.length === 0) return;

    const selectedMaterialData = materials.filter(m => selectedMaterials.includes(m.id));
    
    const csvData = selectedMaterialData.map(material => ({
      'Material ID': material.materialId,
      'Vehicle Type': material.vehicleType,
      'Material Type': material.materialType,
      Category: material.category,
      Description: material.description || '',
      Requirements: material.requirements,
      Status: material.driverId ? 'Used' : 'Available',
      'Driver ID': material.driverId || 'N/A',
      'Driver Name': material.driver?.fullName || 'N/A',
      'Assigned Date': material.assignedDate ? new Date(material.assignedDate).toLocaleDateString() : 'N/A',
      'Created At': new Date(material.createdAt).toLocaleDateString()
    }));

    const headers = Object.keys(csvData[0]).join(',');
    const rows = csvData.map(row => Object.values(row).map(val => `"${val}"`).join(',')).join('\n');
    const csv = `${headers}\n${rows}`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `materials_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addToast({
      type: 'success',
      title: 'Export Successful!',
      message: `${selectedMaterials.length} material(s) exported to CSV`,
      duration: 4000
    });
  };

  const handleAssignSubmit = async (driverId: string) => {
    try {
      await assignMaterialToDriver({
        variables: {
          driverId: driverId,
          materialId: selectedMaterialForAssign?.id
        }
      });
    } catch (error) {
      console.error('Error assigning material:', error);
    }
  };

  const handleViewDetails = (material: Material) => {
    setSelectedMaterialDetails(material);
    setShowDetailsModal(true);
  };

  const handleDeleteMaterial = (id: string) => {
    setMaterialToDelete(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (materialToDelete) {
      try {
        await deleteMaterial({ variables: { id: materialToDelete } });
        setShowDetailsModal(false);
        setSelectedMaterialDetails(null);
        setShowDeleteModal(false);
        setMaterialToDelete(null);
      } catch (error) {
        console.error('Error deleting material:', error);
        setShowDeleteModal(false);
        setMaterialToDelete(null);
      }
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setMaterialToDelete(null);
  };

  const handleCloseModal = () => {
    setShowDetailsModal(false);
    setSelectedMaterialDetails(null);
  };

  const handleRemoveFromDriver = (id: string) => {
    setMaterialToRemove(id);
    setShowRemoveModal(true);
  };

  const confirmRemove = async () => {
    if (materialToRemove && dismountReason.trim()) {
      try {
        await unassignMaterialFromDriver({
          variables: {
            materialId: materialToRemove,
            dismountReason: dismountReason.trim()
          }
        });
        setShowDetailsModal(false);
        setSelectedMaterialDetails(null);
        setShowRemoveModal(false);
        setMaterialToRemove(null);
        setDismountReason('');
      } catch (error) {
        console.error('Error removing material from driver:', error);
        setShowRemoveModal(false);
        setMaterialToRemove(null);
        setDismountReason('');
      }
    } else if (!dismountReason.trim()) {
      addToast({
        type: 'warning',
        title: 'Missing Information',
        message: 'Please provide a reason for removing the material from the driver.',
        duration: 4000
      });
    }
  };

  const cancelRemove = () => {
    setShowRemoveModal(false);
    setMaterialToRemove(null);
    setDismountReason('');
  };

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedMaterials = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  const handleCreateSubmit = async (formData: CreateMaterialInput) => {
    try {
      await createMaterial({
        variables: {
          input: {
            ...formData,
            description: formData.description.trim() || ""
          }
        }
      });
    } catch (error) {
      console.error('Error creating material:', error);
    }
  };

  const handleValidationError = (message: string) => {
    addToast({
      type: 'error',
      title: 'Error!',
      message: message,
      duration: 5000
    });
  };

  // Date editing functions
  const startEditingDates = (materialId: string, material: Material) => {
    setEditingDates(prev => ({
      ...prev,
      [materialId]: {
        mountedAt: material.mountedAt ? formatDateForInput(material.mountedAt) : '',
        dismountedAt: material.dismountedAt ? formatDateForInput(material.dismountedAt) : ''
      }
    }));
  };

  const cancelEditingDates = (materialId: string) => {
    setEditingDates(prev => {
      const newState = { ...prev };
      delete newState[materialId];
      return newState;
    });
  };

  const saveDateChanges = async (materialId: string) => {
    const editData = editingDates[materialId];
    if (!editData) return;

    setSavingDates(prev => ({ ...prev, [materialId]: true }));

    try {
      const input: any = {};
      
      // Mounted date is automatically set when tablet connects - don't allow manual editing
      // (Removed mountedAt editing - it's set automatically in backend when device registers)
      
      // Always send dismountedAt if it's in the edit data (even if empty to clear it)
      if (editData.dismountedAt !== undefined) {
        input.dismountedAt = editData.dismountedAt ? new Date(editData.dismountedAt).toISOString() : null;
      }

      await updateMaterial({
        variables: {
          id: materialId,
          input
        }
      });

      // Clear editing state
      cancelEditingDates(materialId);
    } catch (error) {
      console.error('Error updating dates:', error);
      addToast({
        type: 'error',
        title: 'Error!',
        message: `Error updating dates: ${error}`,
        duration: 5000
      });
    } finally {
      setSavingDates(prev => ({ ...prev, [materialId]: false }));
    }
  };

  const updateEditingDate = (materialId: string, field: 'mountedAt' | 'dismountedAt', value: string) => {
    setEditingDates(prev => ({
      ...prev,
      [materialId]: {
        ...prev[materialId],
        [field]: value
      }
    }));
  };

  const isAllSelected = paginatedMaterials.length > 0 && paginatedMaterials.every(material => selectedMaterials.includes(material.id));

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'N/A';
    
    try {
      const date = new Date(dateString);
      // Check if date is valid
      if (isNaN(date.getTime())) return 'N/A';
      
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'N/A';
    }
  };

  const formatDateForInput = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      
      // Format as datetime-local input format (YYYY-MM-DDTHH:mm)
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    } catch (error) {
      console.error('Error formatting date for input:', error);
      return '';
    }
  };
  const handleRowClick = (material: Material) => {
    handleViewDetails(material);
    setShowDetailsModal(true);
  };

  const contentMargin = isMobile ? 'ml-0 pt-16' : sidebarCollapsed ? 'ml-16' : 'pt-10 pl-72';

  if (error) return <div className={`min-h-screen bg-gray-100 p-6 ${contentMargin} flex items-center justify-center text-red-500 transition-all duration-300`}>Error: {error.message}</div>;

  return (
    <div className={`min-h-screen bg-gray-100 p-6 ${contentMargin} flex flex-col transition-all duration-300`}>
      <div className="flex-1 flex flex-col">
        {/* Header with Filters */}
        <MaterialFilters
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          selectedType={selectedType}
          onTypeChange={setSelectedType}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          sortBy={sortBy}
          onSortChange={setSortBy}
        />

        {/* Tabs Section */}
        <div className="mb-4 flex items-center justify-between">
          <nav className="flex space-x-2">
            <button
              onClick={() => setActiveTab('active')}
              className={`relative flex items-center py-4 px-2 font-medium text-sm transition-colors group ${
                activeTab === 'active' ? 'text-[#3674B5]' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Active Devices
              <span
                className={`absolute bottom-0 left-0 h-[2px] bg-[#3674B5] transition-all duration-300 ${
                  activeTab === 'active' ? 'w-full' : 'w-0 group-hover:w-full'
                }`}
              />
            </button>
            <button
              onClick={() => setActiveTab('archived')}
              className={`relative flex items-center py-4 px-2 font-medium text-sm transition-colors group ${
                activeTab === 'archived' ? 'text-[#3674B5]' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Archived Devices
              <span
                className={`absolute bottom-0 left-0 h-[2px] bg-[#3674B5] transition-all duration-300 ${
                  activeTab === 'archived' ? 'w-full' : 'w-0 group-hover:w-full'
                }`}
              />
            </button>
          </nav>
          <button
            onClick={() => setShowCreateModal(true)}
            className={`py-3 bg-[#feb011] text-xs text-white rounded-lg ${
              isMobile ? 'w-36' : 'w-40'
            } hover:bg-[#FF9B45] hover:scale-105 transition-all duration-300 flex items-center justify-center gap-2`}
          >
            <Plus size={16} />
            Create Device
          </button>
        </div>

        {/* Bulk Actions Bar */}
        {selectedMaterials.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <span className="text-sm font-medium text-blue-800">
                  {selectedMaterials.length} material{selectedMaterials.length > 1 ? 's' : ''} selected
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleBulkDelete}
                    className="px-3 py-1 bg-red-100 text-red-800 text-xs font-medium rounded hover:bg-red-200"
                  >
                    Delete Selected
                  </button>
                  <button
                    onClick={handleBulkAssign}
                    className="px-3 py-1 bg-green-100 text-green-800 text-xs font-medium rounded hover:bg-green-200"
                  >
                    Assign to Driver
                  </button>
                  <button
                    onClick={handleExportToCSV}
                    className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded hover:bg-blue-200"
                  >
                    Export to CSV
                  </button>
                </div>
              </div>
              <button
                onClick={() => setSelectedMaterials([])}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium self-start sm:self-auto"
              >
                Clear Selection
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="rounded-xl mb-5 overflow-hidden">
          {/* Table Header */}
          <div className={`grid gap-4 px-5 py-3 text-sm font-semibold text-gray-500 ${
            activeTab === 'archived' ? 'grid-cols-12' : 'grid-cols-12'
          }`}>
            <div className="flex items-center gap-6 col-span-2">
              <input
                type="checkbox"
                className="form-checkbox"
                onChange={handleSelectAll}
                checked={isAllSelected}
              />
              <span className="mr-40 cursor-pointer" onClick={handleSelectAll}>Type</span>
            </div>
            <div className="col-span-2">ID</div>
            <div className="col-span-1 pl-6">Status</div>
            {activeTab === 'archived' && <div className="col-span-1">Deletion Date</div>}
            <div className="col-span-2 pl-12">Driver Name</div>
            <div className="col-span-2 pl-24">Vehicle Plate</div>
            <div className="col-span-1 ml-28">Action</div>
          </div>
          
          {/* Table Body */}
          {loading ? (
            <AdminLoader />
          ) : (
            <>
              {paginatedMaterials.map((material) => {
                const status = getStatus(material);
                
                return (
                  <div key={material.id} className="bg-white mb-3 rounded-lg shadow-md">
                    <div
                      className={`grid items-center px-5 py-5 text-sm hover:bg-gray-100 transition-colors cursor-pointer ${
                        activeTab === 'archived' ? 'grid-cols-12' : 'grid-cols-12'
                      }`}
                      onClick={() => handleRowClick(material)}
                    >
                      <div className="col-span-2 flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="form-checkbox"
                          checked={selectedMaterials.includes(material.id)}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleMaterialSelect(material.id);
                          }}
                        />
                        <span className="pl-5 truncate">{material.materialType}</span>
                      </div>

                      <div className="col-span-2 pl-1">{material.materialId}</div>

                      <div className="col-span-1 text-center">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            status === 'Used'
                              ? 'bg-red-200 text-red-800'
                              : 'bg-green-200 text-green-800'
                          }`}
                        >
                          {status}
                        </span>
                      </div>
                      
                      {activeTab === 'archived' && (
                        <div className="col-span-1 text-sm text-red-600 font-medium">
                          {material.scheduledDeletionDate ? formatDate(material.scheduledDeletionDate) : 'N/A'}
                        </div>
                      )}

                      <div className="col-span-2 ml-14">{material.driver?.fullName || 'N/A'}</div>
                      <div className="col-span-3 ml-28 truncate">{material.driver?.vehiclePlateNumber || 'N/A'}</div>

                      <div className="col-span-1 flex justify-center gap-1 ml-">
                      {activeTab === 'archived' ? (
                        /* Restore button for archived tab */
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMaterialToRestore(material.id);
                            setShowRestoreModal(true);
                          }}
                          className="group flex items-center text-green-700 overflow-hidden h-8 w-5 hover:w-20 transition-[width] duration-300"
                        >
                          <RotateCcw 
                            className="flex-shrink-0 mx-auto mr-1 transition-all duration-300"
                            size={16} />
                          <span className="opacity-0 group-hover:opacity-100 text-sm group-hover:mr-4 whitespace-nowrap transition-all duration-300">
                            Restore
                          </span>
                        </button>
                      ) : (
                        <>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewDetails(material);
                          }}
                          className="group flex items-center text-gray-700 overflow-hidden h-8 w-5 hover:w-14 transition-[width] duration-300"
                        >
                          <Pencil 
                            className="flex-shrink-0 mx-auto mr-1 transition-all duration-300"
                              size={16} />
                            <span className="opacity-0 group-hover:opacity-100 text-sm group-hover:mr-4 whitespace-nowrap transition-all duration-300">
                              Edit
                            </span>
                        </button> 

                        <button
                          onClick={(e) => {
                          e.stopPropagation(); // ✅ stop row click
                          handleDeleteMaterial(material.id); // ✅ delete action
                        }}
                          className="group flex items-center text-red-700 overflow-hidden h-8 w-5 hover:w-16 transition-[width] duration-300"
                        >
                          <Trash 
                            className="flex-shrink-0 mx-auto mr-1 transition-all duration-300"
                            size={16} />
                            <span className="opacity-0 group-hover:opacity-100 text-sm group-hover:mr-4 whitespace-nowrap transition-all duration-300">
                            Delete
                          </span>
                        </button>
                        </>
                      )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <div className="p-4 text-center text-gray-500">No devices found.</div>
              )}
            </>
          )}
        </div>

        {/* Pagination */}
        <div className="mt-auto flex justify-center">
          <div className="flex items-center space-x-2">
            {/* Previous button */}
            <button
              onClick={handlePreviousPage}
              disabled={currentPage === 1}
              className="flex items-center px-3 py-1 text-sm rounded font-semibold hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </button>

            {/* Page numbers */}
            <div className="flex space-x-1">
              {(() => {
                const pages = [];
                const maxVisiblePages = 3;
                let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
                let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

                if (endPage - startPage + 1 < maxVisiblePages) {
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

            {/* Next button */}
            <button
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
              className="flex items-center px-3 py-1 text-sm rounded font-semibold hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </button>
          </div>
        </div>
      </div>

      {/* Create Device Modal */}
      <CreateMaterialModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateSubmit}
        creating={creating}
        onValidationError={handleValidationError}
      />
      

      {/* Assign Driver Modal */}
      <DriverAssignmentModal
        isOpen={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        material={selectedMaterialForAssign}
        drivers={drivers}
        materials={materials}
        onAssign={handleAssignSubmit}
        assigning={assigning}
      />
      {/* Connection Details Modal */}
      <TabletConnectionModal
        isOpen={showTabletInterface && !showDetailsModal}
        onClose={() => {
          setShowTabletInterface(false);
          setSelectedTabletMaterialId(null);
          setSelectedTabletSlotNumber(null);
          // Restore the Material Details modal if we had one open before
          if (materialBeforeSlotModal) {
            setTimeout(() => {
              setSelectedMaterialDetails(materialBeforeSlotModal);
              setShowDetailsModal(true);
              setMaterialBeforeSlotModal(null);
            }, 100);
          }
        }}
        materialId={selectedTabletMaterialId}
        slotNumber={selectedTabletSlotNumber}
        tabletData={tabletData}
        connectionStatusData={connectionStatusData}
        tabletLoading={tabletLoading}
        tabletError={tabletError}
        connectionStatusLoading={connectionStatusLoading}
        connectionStatusError={connectionStatusError}
        unregistering={unregistering}
        refreshingConnectionStatus={refreshingConnectionStatus}
        creatingTabletConfig={creatingTabletConfig}
        onRefetchTabletData={refetchTabletData}
        onRefetchConnectionStatus={handleRefetchConnectionStatus}
        onCreateTabletConfiguration={handleCreateTabletConfiguration}
        onUnregisterTablet={handleUnregisterTablet}
        onCopyToClipboard={copyToClipboard}
      />

    {/* Material Details Modal */}  
    <MaterialDetailsModal
      isOpen={showDetailsModal && !showTabletInterface}
      onClose={handleCloseModal}
      material={selectedMaterialDetails}
      onRemoveFromDriver={handleRemoveFromDriver}
      onAssignDriver={(material) => {
        setSelectedMaterialForAssign(material);
        setShowAssignModal(true);
      }}
      onShowConnectionDetails={showConnectionDetails}
      editingDates={editingDates}
      savingDates={savingDates}
      onStartEditingDates={startEditingDates}
      onCancelEditingDates={cancelEditingDates}
      onSaveDateChanges={saveDateChanges}
      onUpdateEditingDate={updateEditingDate}
    />
    
    {/* Delete Confirmation Modal */}
    <ConfirmationModal
      isOpen={showDeleteModal}
      onClose={cancelDelete}
      onConfirm={confirmDelete}
      title="Delete Material"
      message="Are you sure you want to delete this material? This action cannot be undone."
      confirmText="Delete"
      cancelText="Cancel"
      confirmButtonClass="bg-red-600 hover:bg-red-700"
    />
    
    {/* Restore Confirmation Modal */}
    {showRestoreModal && materialToRestore && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
        <div className="bg-white rounded-md p-6 max-w-md w-full m-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-800">Restore Material</h2>
            <button
              onClick={() => {
                setShowRestoreModal(false);
                setMaterialToRestore(null);
              }}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <p className="text-gray-600 mb-6">
            Are you sure you want to restore this material?
          </p>

          <div className="flex gap-3 justify-end">
            <button
              onClick={() => {
                setShowRestoreModal(false);
                setMaterialToRestore(null);
              }}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                if (materialToRestore) {
                  try {
                    await restoreMaterial({ variables: { id: materialToRestore } });
                    setShowRestoreModal(false);
                    setMaterialToRestore(null);
                  } catch (error) {
                    console.error('Error restoring material:', error);
                  }
                }
              }}
              className="px-4 py-2 text-white bg-green-600 rounded hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <RotateCcw size={16} />
              Restore
            </button>
          </div>
        </div>
      </div>
    )}
    
    {/* Remove from Driver Confirmation Modal */}
    {showRemoveModal && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
        <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Remove Material from Driver
          </h3>
          <p className="text-gray-600 mb-4">
            Are you sure you want to remove this material from the driver? Please provide a reason for this action.
          </p>
          <div className="mb-4">
            <label htmlFor="dismountReason" className="block text-sm font-medium text-gray-700 mb-2">
              Reason for Removal
            </label>
            <textarea
              id="dismountReason"
              value={dismountReason}
              onChange={(e) => setDismountReason(e.target.value)}
              className="w-full px-3 py-2 border-b border-gray-300 focus:outline-none"
              rows={3}
              required
            />
          </div>
          <div className="flex justify-between space-x-3">
            <button
              onClick={cancelRemove}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">              Cancel
            </button>
            <button
              onClick={confirmRemove}
              disabled={!dismountReason.trim() || unassigning}
              className="px-4 py-2 bg-red-500 text-white rounded-md hover:shadow-md disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {unassigning ? 'Removing...' : 'Remove'}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Bulk Delete Confirmation Modal */}
    <ConfirmationModal
      isOpen={showBulkDeleteModal}
      onClose={() => setShowBulkDeleteModal(false)}
      onConfirm={confirmBulkDelete}
      title="Delete Multiple Materials"
      message={`Are you sure you want to delete ${selectedMaterials.length} material(s)? This action cannot be undone.`}
      confirmText={`Delete ${selectedMaterials.length} Material${selectedMaterials.length > 1 ? 's' : ''}`}
      cancelText="Cancel"
      confirmButtonClass="bg-red-600 hover:bg-red-700"
      isProcessing={isBulkProcessing}
    />

    {/* Bulk Assign Modal */}
    {showBulkAssignModal && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
        <div className="bg-white rounded-lg p-6 max-w-md w-full m-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-800">Assign {selectedMaterials.length} Material(s) to Driver</h2>
            <button
              onClick={() => {
                setShowBulkAssignModal(false);
                setBulkSelectedDriver('');
              }}
              className="text-gray-500 hover:text-gray-700"
            >
              <Pencil size={20} />
            </button>
          </div>

          <p className="text-sm text-gray-600 mb-4">
            Select a driver to assign the selected materials to:
          </p>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Driver
            </label>
            <select
              value={bulkSelectedDriver}
              onChange={(e) => setBulkSelectedDriver(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Select Driver --</option>
              {driversData?.getDriversForMaterials?.map((driver: Driver) => (
                <option key={driver.driverId} value={driver.driverId}>
                  {driver.fullName} - {driver.vehiclePlateNumber}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 justify-end">
            <button
              onClick={() => {
                setShowBulkAssignModal(false);
                setBulkSelectedDriver('');
              }}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
              disabled={isBulkProcessing}
            >
              Cancel
            </button>
            <button
              onClick={confirmBulkAssign}
              disabled={!bulkSelectedDriver || isBulkProcessing}
              className={`px-4 py-2 text-white rounded ${
                !bulkSelectedDriver || isBulkProcessing
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-green-500 hover:bg-green-600'
              }`}
            >
              {isBulkProcessing ? 'Processing...' : `Assign ${selectedMaterials.length} Material${selectedMaterials.length > 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Toast Notifications */}
    <ToastContainer toasts={toasts} onRemove={removeToast} />
    
    {/* Create Tablet Configuration Confirmation Modal */}
    <ConfirmationModal
      isOpen={showCreateTabletModal}
      onClose={cancelCreateTablet}
      onConfirm={confirmCreateTablet}
      title="Create Tablet Configuration"
      message="Create tablet configuration for this HEADDRESS material? This will set up 2 tablet slots."
      confirmText="Create"
      cancelText="Cancel"
      confirmButtonClass="bg-blue-600 hover:bg-blue-700"
      isProcessing={creatingTabletConfig}
    />

    {/* Unregister Tablet Confirmation Modal */}
    <ConfirmationModal
      isOpen={showUnregisterTabletModal}
      onClose={cancelUnregisterTablet}
      onConfirm={confirmUnregisterTablet}
      title="Unregister Tablet"
      message="Are you sure you want to unregister this tablet? This will disconnect the device from the system."
      confirmText="Unregister"
      cancelText="Cancel"
      confirmButtonClass="bg-red-600 hover:bg-red-700"
      isProcessing={unregistering}
    />
    </div>
  );
};

export default Materials;