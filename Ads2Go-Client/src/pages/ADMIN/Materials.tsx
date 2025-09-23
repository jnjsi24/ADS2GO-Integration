import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { Trash, Edit } from 'lucide-react';
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
  CREATE_TABLET_CONFIGURATION 
} from '../../graphql/admin/mutations/materials';
import CreateMaterialModal from './tabs/materials/CreateMaterialModal';
import MaterialDetailsModal from './tabs/materials/MaterialDetailsModal';
import TabletConnectionModal from './tabs/materials/TabletConnectionModal';
import DriverAssignmentModal from './tabs/materials/DriverAssignmentModal';
import MaterialFilters from './tabs/materials/MaterialFilters';

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
          driverId: driverId
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

  const handleDeleteMaterial = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this material?')) {
      try {
        await deleteMaterial({ variables: { id } });
        setShowDetailsModal(false);
        setSelectedMaterialDetails(null);
      } catch (error) {
        console.error('Error deleting material:', error);
      }
    }
  };

  const handleCloseModal = () => {
    setShowDetailsModal(false);
    setSelectedMaterialDetails(null);
  };

  const handleRemoveFromDriver = async (id: string) => {
    if (window.confirm('Are you sure you want to remove this material from the driver?')) {
      try {
        await updateMaterial({
          variables: {
            id,
            input: {
              driverId: null
            }
          }
        });
        setShowDetailsModal(false);
        setSelectedMaterialDetails(null);
      } catch (error) {
        console.error('Error removing material from driver:', error);
      }
    }
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
      
      if (editData.mountedAt) {
        input.mountedAt = new Date(editData.mountedAt).toISOString();
      }
      
      if (editData.dismountedAt) {
        input.dismountedAt = new Date(editData.dismountedAt).toISOString();
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
        <div className="rounded-xl mb-4 overflow-hidden">
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
          {filtered.map((material) => {
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
                      <Edit 
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

        {/* Footer */}
        <div className="flex justify-between items-center text-gray-600 mt-4">
          <span className="text-sm">Found: {filtered.length} materials - Selected: {selectedMaterials.length}</span>
          <button className="px-4 py-2 border border-green-600 text-green-600 rounded-xl hover:bg-green-50 text-sm">
            Export {selectedMaterials.length > 0 ? `${selectedMaterials.length} Selected Materials` : 'to Excel'}
          </button>
        </div>

        {/* Pagination */}
        <div className="flex justify-center items-center mt-6 gap-2 text-sm flex-wrap">
          <button className="px-2 py-1 border rounded-xl text-gray-400 cursor-not-allowed">← Previous</button>
          <button className="px-2 py-1 bg-blue-600 text-white rounded-xl">1</button>
          <button className="px-2 py-1 border rounded-xl">2</button>
          <button className="px-2 py-1 border rounded-xl">3</button>
          <button className="px-2 py-1 border rounded-xl">4</button>
          <button className="px-2 py-1 border rounded-xl">5</button>
          <span className="text-gray-500">...</span>
          <button className="px-2 py-1 border rounded-xl">31</button>
          <button className="px-2 py-1 border rounded-xl text-blue-600">Next →</button>
          <button className="px-2 py-1 text-blue-600">Show all</button>
        </div>
      </div>

      {/* Create Material Modal */}
      <CreateMaterialModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateSubmit}
        creating={creating}
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
        creatingTabletConfig={creatingTabletConfig}
        onRefetchTabletData={refetchTabletData}
        onRefetchConnectionStatus={refetchConnectionStatus}
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
    </div>
  );
};

export default Materials;