import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { Trash, ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import { 
  GET_ALL_MATERIALS, 
  GET_TABLETS_BY_MATERIAL, 
  GET_TABLET_CONNECTION_STATUS, 
  GET_DRIVERS_FOR_MATERIALS 
} from '../../graphql/admin/queries/materials';
import { 
  CREATE_MATERIAL, 
  DELETE_MATERIAL, 
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
  mountedAt?: string;
  dismountedAt?: string;
  createdAt: string;
  updatedAt: string;
  // Material condition and inspection fields
  materialCondition?: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'DAMAGED';
  inspectionPhotos?: InspectionPhoto[];
  photoComplianceStatus?: 'COMPLIANT' | 'NON_COMPLIANT' | 'PENDING';
  lastInspectionDate?: string;
  nextInspectionDue?: string;
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
  const [selectedType, setSelectedType] = useState<'All' | 'POSTER' | 'LCD' | 'STICKER' | 'HEADDRESS' | 'BANNER'>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Used' | 'Available'>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedMaterialDetails, setSelectedMaterialDetails] = useState<Material | null>(null);

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
  const [unregistering, setUnregistering] = useState(false);
  const [creatingTabletConfig, setCreatingTabletConfig] = useState(false);
  const [refreshingConnectionStatus, setRefreshingConnectionStatus] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [materialToDelete, setMaterialToDelete] = useState<string | null>(null);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [materialToRemove, setMaterialToRemove] = useState<string | null>(null);
  const [dismountReason, setDismountReason] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  

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
    onCompleted: (data) => {
      console.log('Materials data loaded:', data);
    },
    onError: (error) => {
      console.error('Error loading materials:', error);
    }
  });

  const { data: driversData, loading: driversLoading } = useQuery(GET_DRIVERS_FOR_MATERIALS, {
    context: {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    },
    errorPolicy: 'all',
    onError: (error) => {
      console.error('Error loading drivers:', error);
    }
  });

  const [createMaterial, { loading: creating }] = useMutation(CREATE_MATERIAL, {
    context: {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    },
    onCompleted: () => {
      setShowCreateModal(false);
      refetch();
    },
    onError: (error) => {
      alert(`Error creating material: ${error.message}`);
    }
  });

  const [deleteMaterial] = useMutation(DELETE_MATERIAL, {
    context: {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    },
    onCompleted: () => {
      refetch();
    },
    onError: (error) => {
      alert(`Error deleting material: ${error.message}`);
    }
  });

  // Tablet query hook
  const { data: tabletData, loading: tabletLoading, error: tabletError, refetch: refetchTabletData } = useQuery(GET_TABLETS_BY_MATERIAL, {
    variables: { materialId: selectedTabletMaterialId || '' },
    pollInterval: 5000, // Refresh every 5 seconds for faster updates
    context: {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    },
    skip: !selectedTabletMaterialId,
    errorPolicy: 'all',
    fetchPolicy: 'cache-and-network',
    onCompleted: (data) => {
      console.log('Tablet query completed:', { materialId: selectedTabletMaterialId, data });
    },
    onError: (error) => {
      console.error('Error loading tablets:', error);
    }
  });

  // Tablet connection status query hook
  const { data: connectionStatusData, loading: connectionStatusLoading, error: connectionStatusError, refetch: refetchConnectionStatus } = useQuery(GET_TABLET_CONNECTION_STATUS, {
    variables: { 
      materialId: selectedTabletMaterialId || '', 
      slotNumber: selectedTabletSlotNumber || 1 
    },
    pollInterval: 5000, // Refresh every 5 seconds for faster updates
    context: {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    },
    skip: !selectedTabletMaterialId || !selectedTabletSlotNumber,
    errorPolicy: 'all',
    fetchPolicy: 'cache-and-network',
    onCompleted: (data) => {
      console.log('Connection status query completed:', { materialId: selectedTabletMaterialId, slotNumber: selectedTabletSlotNumber, data });
    },
    onError: (error) => {
      console.error('Error loading tablet connection status:', error);
    }
  });

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
      // Show a more user-friendly notification
      const notification = document.createElement('div');
      notification.textContent = 'Connection details copied to clipboard!';
      notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-[70] transition-opacity duration-300';
      document.body.appendChild(notification);
      
      setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => {
          document.body.removeChild(notification);
        }, 300);
      }, 2000);
    }).catch(() => {
      alert('Failed to copy to clipboard. Please try again.');
    });
  };

  // Function to show connection details modal
  const showConnectionDetails = (materialId: string, slotNumber: number) => {
    console.log('Opening connection details for:', { materialId, slotNumber });
    setSelectedTabletMaterialId(materialId);
    setSelectedTabletSlotNumber(slotNumber);
    setShowTabletInterface(true);
  };

  // Function to create tablet configuration
  const handleCreateTabletConfiguration = async () => {
    if (!selectedTabletMaterialId) {
      alert('Missing material ID');
      return;
    }

    if (!window.confirm('Create tablet configuration for this HEADDRESS material? This will set up 2 tablet slots.')) {
      return;
    }

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
    }
  };

  // Function to unregister tablet
  const handleUnregisterTablet = async () => {
    if (!selectedTabletMaterialId || !selectedTabletSlotNumber || !tabletData?.getTabletsByMaterial?.[0]?.carGroupId) {
      alert('Missing required information for unregistration');
      return;
    }

    // Use window.confirm instead of confirm to avoid ESLint error
    if (!window.confirm('Are you sure you want to unregister this tablet? This will disconnect the device from the system.')) {
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
    }
  };

  const [updateMaterial] = useMutation(UPDATE_MATERIAL, {
    context: {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    },
    onCompleted: () => {
      refetch();
    },
    onError: (error) => {
      alert(`Error updating material: ${error.message}`);
    }
  });

  const [assignMaterialToDriver, { loading: assigning }] = useMutation(ASSIGN_MATERIAL_TO_DRIVER, {
    context: {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    },
    onCompleted: (data) => {
      if (data.assignMaterialToDriver.success) {
        alert(data.assignMaterialToDriver.message);
        setShowAssignModal(false);
        setSelectedMaterialForAssign(null);
        refetch();
      } else {
        alert(`Assignment failed: ${data.assignMaterialToDriver.message}`);
      }
    },
    onError: (error) => {
      alert(`Error assigning material: ${error.message}`);
    }
  });

  const [unassignMaterialFromDriver, { loading: unassigning }] = useMutation(UNASSIGN_MATERIAL_FROM_DRIVER, {
    context: {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    },
    onCompleted: (data) => {
      if (data.unassignMaterialFromDriver.success) {
        alert(data.unassignMaterialFromDriver.message);
        setShowRemoveModal(false);
        setMaterialToRemove(null);
        setDismountReason('');
        refetch();
      } else {
        alert(`Unassignment failed: ${data.unassignMaterialFromDriver.message}`);
      }
    },
    onError: (error) => {
      alert(`Error unassigning material: ${error.message}`);
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
        alert(data.unregisterTablet.message);
        refetchConnectionStatus();
      } else {
        alert(`Unregistration failed: ${data.unregisterTablet.message}`);
      }
      setUnregistering(false);
    },
    onError: (error) => {
      alert(`Error unregistering tablet: ${error.message}`);
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
        alert(data.createTabletConfiguration.message);
        // Refetch tablet data
        if (selectedTabletMaterialId) {
          // Refetch the tablet data
          refetch();
        }
      } else {
        alert(`Failed to create tablet configuration: ${data.createTabletConfiguration.message}`);
      }
      setCreatingTabletConfig(false);
    },
    onError: (error) => {
      alert(`Error creating tablet configuration: ${error.message}`);
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

  // Filter materials
  const filtered = materials.filter((material) => {
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
  });

  const handleMaterialSelect = (id: string) => {
    setSelectedMaterials(prevSelected =>
      prevSelected.includes(id)
        ? prevSelected.filter(materialId => materialId !== id)
        : [...prevSelected, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedMaterials.length === filtered.length) {
      setSelectedMaterials([]);
    } else {
      setSelectedMaterials(filtered.map(material => material.id));
    }
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
      alert('Please provide a reason for removing the material from the driver.');
    }
  };

  const cancelRemove = () => {
    setShowRemoveModal(false);
    setMaterialToRemove(null);
    setDismountReason('');
  };

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
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
      
      // Always send mountedAt if it's in the edit data (even if empty to clear it)
      if (editData.mountedAt !== undefined) {
        input.mountedAt = editData.mountedAt ? new Date(editData.mountedAt).toISOString() : null;
      }
      
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
      alert(`Error updating dates: ${error}`);
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

  const isAllSelected = selectedMaterials.length === filtered.length && filtered.length > 0;

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

  if (loading) return <div className="min-h-screen bg-gray-100 pl-64 pr-5 p-10 flex items-center justify-center">Loading materials...</div>;
  if (error) return <div className="min-h-screen bg-gray-100 pl-64 pr-5 p-10 flex items-center justify-center text-red-500">Error: {error.message}</div>;

  return (
    <div className="min-h-screen bg-gray-100 pl-64 pr-5 p-10">
      <div className="bg-gray-100 w-full min-h-screen">
        {/* Header with Filters */}
        <MaterialFilters
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          selectedType={selectedType}
          onTypeChange={setSelectedType}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          onCreateClick={() => setShowCreateModal(true)}
        />

        {/* Table */}
        <div className="rounded-xl mb-5 overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 px-5 py-3 text-sm font-semibold text-gray-500">
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
            <div className="col-span-2 pl-16">Status</div>
            <div className="col-span-2 pl-12">Driver Name</div>
            <div className="col-span-2 pl-24">Vehicle Plate</div>
            <div className="col-span-1 ml-28">Action</div>
          </div>
          
          {/* Table Body */}
          {filtered
          .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
          .map((material) => {
            const status = getStatus(material);
            
            return (
              <div key={material.id} className="bg-white mb-3 rounded-lg shadow-md">
                <div
                  className="grid grid-cols-12 items-center px-5 py-5 text-sm hover:bg-gray-100 transition-colors cursor-pointer"
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

                  <div className="col-span-2 text-center">
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

                  <div className="col-span-2 ml-14">{material.driver?.fullName || 'N/A'}</div>
                  <div className="col-span-3 ml-28 truncate">{material.driver?.vehiclePlateNumber || 'N/A'}</div>

                  <div className="col-span-1 flex justify-center gap-1 ml-">
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
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="p-4 text-center text-gray-500">No materials found.</div>
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

      {/* Create Material Modal */}
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
        isOpen={showTabletInterface}
        onClose={() => {
          setShowTabletInterface(false);
          setSelectedTabletMaterialId(null);
          setSelectedTabletSlotNumber(null);
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
      isOpen={showDetailsModal}
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
    
    {/* Remove from Driver Confirmation Modal */}
    {showRemoveModal && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Remove Material from Driver
          </h3>
          <p className="text-gray-600 mb-4">
            Are you sure you want to remove this material from the driver? Please provide a reason for this action.
          </p>
          <div className="mb-4">
            <label htmlFor="dismountReason" className="block text-sm font-medium text-gray-700 mb-2">
              Reason for Removal *
            </label>
            <textarea
              id="dismountReason"
              value={dismountReason}
              onChange={(e) => setDismountReason(e.target.value)}
              placeholder="Please provide a reason for removing this material from the driver..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
              required
            />
          </div>
          <div className="flex justify-end space-x-3">
            <button
              onClick={cancelRemove}
              className="px-4 py-2 text-gray-700 rounded-lg border hover:bg-gray-50 hover:text-gray-900 transition-colors"
              disabled={unassigning}
            >
              Cancel
            </button>
            <button
              onClick={confirmRemove}
              disabled={!dismountReason.trim() || unassigning}
              className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {unassigning ? 'Removing...' : 'Remove'}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Toast Notifications */}
    <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
};

export default Materials;