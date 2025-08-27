import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { gql } from '@apollo/client';
import { ChevronDown, TrashIcon, Edit, X, Plus, UserX, Check, Calendar, UserPlus } from 'lucide-react';

// GraphQL Queries
const GET_ALL_MATERIALS = gql`
  query GetAllMaterials {
    getAllMaterials {
      id
      materialId
      vehicleType
      materialType
      description
      requirements
      category
      driverId
      driver {
        driverId
        fullName
        email
        contactNumber
        vehiclePlateNumber
      }
      mountedAt
      dismountedAt
      createdAt
      updatedAt
    }
  }
`;

// GraphQL Mutations
const CREATE_MATERIAL = gql`
  mutation CreateMaterial($input: CreateMaterialInput!) {
    createMaterial(input: $input) {
      id
      materialId
      vehicleType
      materialType
      description
      requirements
      category
      driverId
      mountedAt
      dismountedAt
      createdAt
      updatedAt
    }
  }
`;

const DELETE_MATERIAL = gql`
  mutation DeleteMaterial($id: ID!) {
    deleteMaterial(id: $id)
  }
`;

const ASSIGN_MATERIAL_TO_DRIVER = gql`
  mutation AssignMaterialToDriver($driverId: String!) {
    assignMaterialToDriver(driverId: $driverId) {
      success
      message
      material {
        id
        materialId
        vehicleType
        materialType
        driverId
        driver {
          driverId
          fullName
          email
          contactNumber
          vehiclePlateNumber
        }
        mountedAt
        dismountedAt
      }
      driver {
        driverId
        fullName
        email
        contactNumber
        vehiclePlateNumber
      }
    }
  }
`;

const GET_ALL_DRIVERS = gql`
  query GetAllDrivers {
    getAllDrivers {
      driverId
      fullName
      email
      contactNumber
      vehiclePlateNumber
      vehicleType
      preferredMaterialType
    }
  }
`;

const UPDATE_MATERIAL = gql`
  mutation UpdateMaterial($id: ID!, $input: UpdateMaterialInput!) {
    updateMaterial(id: $id, input: $input) {
      id
      materialId
      vehicleType
      materialType
      description
      requirements
      category
      driverId
      driver {
        driverId
        fullName
        email
        contactNumber
        vehiclePlateNumber
      }
      mountedAt
      dismountedAt
      createdAt
      updatedAt
    }
  }
`;

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
  materialId: string;
  category: 'DIGITAL' | 'NON_DIGITAL';
}

// Vehicle-Material mapping based on your requirements
const VEHICLE_MATERIAL_MAP = {
  DIGITAL: {
    CAR: ['HEADDRESS', 'LCD'],
    MOTORCYCLE: ['LCD'],
    BUS: ['LCD'],
    JEEP: ['LCD'],
    E_TRIKE: ['LCD']
  },
  NON_DIGITAL: {
    CAR: ['BANNER', 'STICKER'],
    MOTORCYCLE: ['BANNER', 'STICKER'],
    BUS: ['BANNER', 'STICKER'],
    JEEP: ['BANNER', 'STICKER'],
    E_TRIKE: ['BANNER', 'STICKER']
  }
};

const Materials: React.FC = () => {
  const [selectedType, setSelectedType] = useState<'All' | 'POSTER' | 'LCD' | 'STICKER' | 'HEADDRESS' | 'BANNER'>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Used' | 'Available'>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState<CreateMaterialInput>({
    vehicleType: 'CAR',
    materialType: 'LCD',
    description: '',
    requirements: '',
    category: 'DIGITAL'
  });

  // State for date editing
  const [editingDates, setEditingDates] = useState<{[key: string]: {mountedAt: string, dismountedAt: string}}>({});
  const [savingDates, setSavingDates] = useState<{[key: string]: boolean}>({});
  
  // State for manual assignment
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedMaterialForAssign, setSelectedMaterialForAssign] = useState<Material | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');

  // Get available material types based on vehicle and category
  const getAvailableMaterialTypes = (vehicleType: string, category: string) => {
    return VEHICLE_MATERIAL_MAP[category as keyof typeof VEHICLE_MATERIAL_MAP]?.[vehicleType as keyof typeof VEHICLE_MATERIAL_MAP.DIGITAL] || [];
  };

  // Update material type when vehicle type or category changes
  useEffect(() => {
    const availableTypes = getAvailableMaterialTypes(createForm.vehicleType, createForm.category);
    if (availableTypes.length > 0 && !availableTypes.includes(createForm.materialType)) {
      setCreateForm(prev => ({
        ...prev,
        materialType: availableTypes[0] as any
      }));
    }
  }, [createForm.vehicleType, createForm.category]);

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

  const { data: driversData, loading: driversLoading } = useQuery(GET_ALL_DRIVERS, {
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
      setCreateForm({
        vehicleType: 'CAR',
        materialType: 'LCD',
        description: '',
        requirements: '',
        category: 'DIGITAL'
      });
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
        setSelectedDriverId('');
        refetch();
      } else {
        alert(`Assignment failed: ${data.assignMaterialToDriver.message}`);
      }
    },
    onError: (error) => {
      alert(`Error assigning material: ${error.message}`);
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

  // Manual assignment functions
  const openAssignModal = (material: Material) => {
    if (material.driverId) {
      alert('This material is already assigned to a driver. Please remove it first before reassigning.');
      return;
    }
    setSelectedMaterialForAssign(material);
    setShowAssignModal(true);
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDriverId || !selectedMaterialForAssign) {
      alert('Please select a driver');
      return;
    }

    try {
      // Note: The backend logic will automatically find and assign an available material
      // of the appropriate type for this driver. Since we're selecting a specific material
      // through the UI, we inform the user about this behavior.
      await assignMaterialToDriver({
        variables: {
          driverId: selectedDriverId
        }
      });
    } catch (error) {
      console.error('Error assigning material:', error);
    }
  };

  const closeAssignModal = () => {
    setShowAssignModal(false);
    setSelectedMaterialForAssign(null);
    setSelectedDriverId('');
  };

  // Filter available drivers based on material requirements AND preferences
  const getCompatibleDrivers = (material: Material): DriverWithVehicleType[] => {
    console.log('Filtering drivers for material:', material);
    console.log('All drivers:', drivers);
    
    // Get all driver IDs that currently have materials assigned
    const assignedDriverIds = materials
      .filter(mat => mat.driverId)
      .map(mat => mat.driverId);

    console.log('Assigned driver IDs:', assignedDriverIds);

    // Filter drivers by vehicle type compatibility, availability, and material preferences
    const compatibleDrivers = drivers.filter((driver: DriverWithVehicleType) => {
      const isVehicleTypeCompatible = driver.vehicleType === material.vehicleType;
      const isDriverAvailable = !assignedDriverIds.includes(driver.driverId);
      
      // Check if driver has material preferences
      const hasPreferences = driver.preferredMaterialType && driver.preferredMaterialType.length > 0;
      
      // If driver has preferences, check if the material type matches their preferences
      const matchesPreferences = hasPreferences 
        ? driver.preferredMaterialType!.includes(material.materialType)
        : true; // If no preferences set, accept all compatible material types
      
      console.log(`Driver ${driver.fullName}:`, {
        vehicleType: driver.vehicleType,
        isVehicleTypeCompatible,
        isDriverAvailable,
        hasPreferences,
        preferredMaterialType: driver.preferredMaterialType,
        materialType: material.materialType,
        matchesPreferences
      });

      return isVehicleTypeCompatible && isDriverAvailable && matchesPreferences;
    });

    console.log('Compatible drivers found:', compatibleDrivers);
    return compatibleDrivers;
  };

  const handleDeleteMaterial = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this material?')) {
      try {
        await deleteMaterial({ variables: { id } });
        setExpandedId(null);
      } catch (error) {
        console.error('Error deleting material:', error);
      }
    }
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
        setExpandedId(null);
      } catch (error) {
        console.error('Error removing material from driver:', error);
      }
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.requirements.trim()) {
      alert('Requirements field is required');
      return;
    }

    try {
      await createMaterial({
        variables: {
          input: {
            ...createForm,
            description: createForm.description.trim() || ""
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

  if (loading) return <div className="min-h-screen bg-gray-100 pl-64 pr-5 p-10 flex items-center justify-center">Loading materials...</div>;
  if (error) return <div className="min-h-screen bg-gray-100 pl-64 pr-5 p-10 flex items-center justify-center text-red-500">Error: {error.message}</div>;

  return (
    <div className="min-h-screen bg-gray-100 pl-64 pr-5 p-10">
      <div className="bg-gray-100 w-full min-h-screen">
        {/* Header with Title and Add New Button */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="px-3 py-1 text-3xl font-bold text-gray-800">Materials List</h1>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-[#3674B5] text-white rounded-xl w-44 hover:bg-[#578FCA] hover:scale-105 transition-all duration-300 flex items-center justify-center gap-2"
          >
            <Plus size={16} />
            Add New Material
          </button>
        </div>

        {/* Search Bar and Filters */}
        <div className="flex justify-between items-center mb-4">
          <input
            type="text"
            className="text-xs text-black rounded-xl pl-5 py-3 w-60 shadow-md border border-gray-400 focus:outline-none appearance-none bg-white"
            placeholder="Search materials..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <div className="flex space-x-2">
            <div className="relative w-32">
              <select
                className="text-xs text-black rounded-xl pl-5 py-3 pr-8 w-full shadow-md border border-gray-400 focus:outline-none appearance-none bg-white"
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value as typeof selectedType)}
              >
                <option value="All">All Materials</option>
                <option value="LCD">LCD</option>
                <option value="BANNER">BANNER</option>
                <option value="STICKER">STICKER</option>
                <option value="HEADDRESS">HEADDRESS</option>
                <option value="POSTER">POSTER</option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </div>
            </div>
            <div className="relative w-32">
              <select
                className="text-xs text-black rounded-xl pl-5 py-3 pr-8 w-full shadow-md border border-gray-400 focus:outline-none appearance-none bg-white"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              >
                <option value="All">All Status</option>
                <option value="Used">Used</option>
                <option value="Available">Available</option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-xl shadow-md mb-4 overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 bg-[#3674B5] px-4 py-2 text-sm font-semibold text-white">
            <div className="flex items-center gap-10 col-span-2">
              <input
                type="checkbox"
                className="form-checkbox"
                onChange={handleSelectAll}
                checked={isAllSelected}
              />
              <span className="cursor-pointer" onClick={handleSelectAll}>Name</span>
            </div>
            <div className="col-span-1">ID</div>
            <div className="col-span-2">Type</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2">Driver Name</div>
            <div className="col-span-2">Vehicle Plate</div>
            <div className="col-span-1 text-center">Action</div>
          </div>
          
          {/* Table Body */}
          {filtered.map((material) => {
            const status = getStatus(material);
            const isEditingThisMaterial = editingDates[material.id];
            const isSaving = savingDates[material.id];
            
            return (
              <div
                key={material.id}
                className={`
                  bg-white border-t border-gray-300 transition-all duration-500 ease-in-out transform origin-top
                  ${expandedId === material.id ? 'z-10 relative scale-105 shadow-xl' : ''}
                `}
              >
                {expandedId !== material.id ? (
                  // Collapsed Card
                  <div
                    className="grid grid-cols-12 items-center px-4 py-3 text-sm hover:bg-gray-100 transition-colors cursor-pointer"
                    onClick={() => setExpandedId(material.id)}
                  >
                    <div className="col-span-2 gap-10 flex items-center">
                      <input
                        type="checkbox"
                        className="form-checkbox"
                        checked={selectedMaterials.includes(material.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleMaterialSelect(material.id);
                        }}
                      />
                      <div className="flex items-center">
                        <span className="truncate">{material.materialType}</span>
                      </div>
                    </div>
                    <div className="col-span-1 truncate">{material.materialId}</div>
                    <div className="col-span-2 truncate">{material.materialType}</div>
                    <div className="col-span-2">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          status === 'Used' ? 'bg-red-200 text-red-800' : 'bg-green-200 text-green-800'
                        }`}
                      >
                        {status}
                      </span>
                    </div>
                    <div className="col-span-2 truncate">{material.driver?.fullName || 'N/A'}</div>
                    <div className="col-span-2 truncate">{material.driver?.vehiclePlateNumber || 'N/A'}</div>
                    <div className="col-span-1 flex justify-center items-center">
                      <ChevronDown size={16} className="text-gray-500" />
                    </div>
                  </div>
                ) : (
                  // Expanded Details
                  <div className="bg-white p-6 shadow-xl rounded-md flex flex-col lg:flex-row items-start justify-between">
                    {/* Left Section: Details */}
                    <div className="flex items-start pl-6 gap-4 mb-6 lg:mb-0 lg:pr-8 border-b lg:border-b-0 lg:border-r border-gray-200 w-full lg:w-1/3">
                      <div className="flex-grow">
                        <h3 className="text-xl font-bold text-gray-800 mb-1">
                          {material.materialType}
                        </h3>
                        <div className="text-sm text-gray-600 space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-gray-700">ID:</span>
                            <span className="text-gray-600">{material.materialId}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-gray-700">Type:</span>
                            <span className="text-gray-600">{material.materialType}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-gray-700">Category:</span>
                            <span className="text-gray-600">{material.category}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-gray-700">Status:</span>
                            <span
                              className={`px-2 py-1 text-xs font-medium rounded-full ${
                                status === 'Used' ? 'bg-red-200 text-red-800' : 'bg-green-200 text-green-800'
                              }`}
                            >
                              {status}
                            </span>
                          </div>
                          {material.description && (
                            <div className="mt-2">
                              <span className="font-semibold text-gray-700">Description:</span>
                              <p className="text-gray-600 text-xs mt-1">{material.description}</p>
                            </div>
                          )}
                          {material.requirements && (
                            <div className="mt-2">
                              <span className="font-semibold text-gray-700">Requirements:</span>
                              <p className="text-gray-600 text-xs mt-1">{material.requirements}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Middle Section: Date Details */}
                    <div className="flex flex-col gap-4 mt-6 lg:mb-0 lg:px-8 border-b lg:border-b-0 lg:border-r border-gray-200 w-full lg:w-1/3">
                      <div className="text-sm">
                        <div className="space-y-3">
                          {/* Editable Mounted Date */}
                          <div className="flex flex-col space-y-1">
                            <div className="flex justify-between items-center">
                              <span className="font-semibold text-gray-700">Mounted Date:</span>
                              {!isEditingThisMaterial && (
                                <button
                                  onClick={() => startEditingDates(material.id, material)}
                                  className="p-1 text-blue-500 hover:bg-blue-50 rounded transition-colors"
                                  title="Edit dates"
                                >
                                  <Calendar size={14} />
                                </button>
                              )}
                            </div>
                            {isEditingThisMaterial ? (
                              <input
                                type="datetime-local"
                                value={isEditingThisMaterial.mountedAt}
                                onChange={(e) => updateEditingDate(material.id, 'mountedAt', e.target.value)}
                                className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            ) : (
                              <span className="text-gray-600 text-xs">{formatDate(material.mountedAt)}</span>
                            )}
                          </div>

                          {/* Editable Dismounted Date */}
                          <div className="flex flex-col space-y-1">
                            <span className="font-semibold text-gray-700">Dismounted Date:</span>
                            {isEditingThisMaterial ? (
                              <input
                                type="datetime-local"
                                value={isEditingThisMaterial.dismountedAt}
                                onChange={(e) => updateEditingDate(material.id, 'dismountedAt', e.target.value)}
                                className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            ) : (
                              <span className="text-gray-600 text-xs">{formatDate(material.dismountedAt)}</span>
                            )}
                          </div>

                          {/* Save/Cancel buttons for date editing */}
                          {isEditingThisMaterial && (
                            <div className="flex gap-2 pt-2">
                              <button
                                onClick={() => saveDateChanges(material.id)}
                                disabled={isSaving}
                                className="px-3 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600 disabled:bg-gray-400 flex items-center gap-1"
                              >
                                {isSaving ? 'Saving...' : <><Check size={12} /> Save</>}
                              </button>
                              <button
                                onClick={() => cancelEditingDates(material.id)}
                                disabled={isSaving}
                                className="px-3 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600 disabled:bg-gray-400 flex items-center gap-1"
                              >
                                <X size={12} /> Cancel
                              </button>
                            </div>
                          )}

                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-gray-700">Created:</span>
                            <span className="text-gray-600 text-xs">{formatDate(material.createdAt)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-gray-700">Updated:</span>
                            <span className="text-gray-600 text-xs">{formatDate(material.updatedAt)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right Section: Driver Details and Actions */}
                    <div className="flex flex-col gap-4 w-full lg:w-1/3 pt-6 lg:pt-0 lg:pl-8">
                      <div className="absolute top-4 right-4 pr-6 flex items-center gap-2">
                        {!material.driverId && (
                          <button
                            onClick={() => openAssignModal(material)}
                            className="p-1 text-blue-500 rounded-full hover:bg-gray-100 transition-colors"
                            title="Assign to driver"
                          >
                            <UserPlus size={16} />
                          </button>
                        )}
                        {material.driverId && (
                          <button
                            onClick={() => handleRemoveFromDriver(material.id)}
                            className="p-1 text-orange-500 rounded-full hover:bg-gray-100 transition-colors"
                            title="Remove from driver"
                          >
                            <UserX size={16} />
                          </button>
                        )}
                        <button className="p-1 text-[#3674B5] rounded-full hover:bg-gray-100 transition-colors">
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteMaterial(material.id)}
                          className="p-1 text-red-500 rounded-full hover:bg-gray-100 transition-colors"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                        <button
                          className="p-1 text-gray-500 rounded-full hover:bg-gray-100 transition-colors"
                          onClick={() => setExpandedId(null)}
                        >
                          <X size={16} />
                        </button>
                      </div>
                      <div className="text-sm mt-6">
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-gray-700">Driver Name:</span>
                            <span className="text-gray-600 text-right max-w-32 truncate">
                              {material.driver?.fullName || (material.driverId ? 'Loading...' : 'N/A')}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-gray-700">Vehicle Plate:</span>
                            <span className="text-gray-600 text-right max-w-32 truncate">
                              {material.driver?.vehiclePlateNumber || (material.driverId ? 'Loading...' : 'N/A')}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-gray-700">Car Type:</span>
                            <span className="text-gray-600">{material.vehicleType || 'N/A'}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-gray-700">Driver Contact:</span>
                            <span className="text-gray-600 text-right max-w-32 truncate">
                              {material.driver?.contactNumber || (material.driverId ? 'Loading...' : 'N/A')}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-gray-700">Driver Email:</span>
                            <span className="text-gray-600 text-right max-w-32 truncate">
                              {material.driver?.email || (material.driverId ? 'Loading...' : 'N/A')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
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
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-800">Create New Material</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={createForm.category}
                  onChange={(e) => setCreateForm({...createForm, category: e.target.value as 'DIGITAL' | 'NON_DIGITAL'})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="DIGITAL">Digital</option>
                  <option value="NON_DIGITAL">Non-Digital</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vehicle Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={createForm.vehicleType}
                  onChange={(e) => setCreateForm({...createForm, vehicleType: e.target.value as any})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="CAR">Car</option>
                  <option value="MOTORCYCLE">Motorcycle</option>
                  <option value="BUS">Bus</option>
                  <option value="JEEP">Jeep</option>
                  <option value="E_TRIKE">E-Trike</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Material Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={createForm.materialType}
                  onChange={(e) => setCreateForm({...createForm, materialType: e.target.value as any})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  {getAvailableMaterialTypes(createForm.vehicleType, createForm.category).map((type) => (
                    <option key={type} value={type}>
                      {type.charAt(0) + type.slice(1).toLowerCase()}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={createForm.description}
                  onChange={(e) => setCreateForm({...createForm, description: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter description"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Requirements <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={createForm.requirements}
                  onChange={(e) => setCreateForm({...createForm, requirements: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter material requirements"
                  rows={3}
                  required
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 px-4 py-2 bg-[#3674B5] text-white rounded-lg hover:bg-[#578FCA] disabled:bg-gray-400"
                >
                  {creating ? 'Creating...' : 'Create Material'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Assignment Modal */}
      {showAssignModal && selectedMaterialForAssign && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-800">Assign Material to Driver</h2>
              <button
                onClick={closeAssignModal}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-semibold text-blue-800 mb-2">📋 Material Assignment:</h3>
              <div className="text-sm text-blue-700">
                The system will assign an available material of the selected type to the chosen driver based on compatibility and preferences.
              </div>
            </div>

            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <h3 className="font-semibold text-gray-700 mb-2">Target Material Details:</h3>
              <div className="text-sm text-gray-600 space-y-1">
                <div><span className="font-medium">ID:</span> {selectedMaterialForAssign.materialId}</div>
                <div><span className="font-medium">Type:</span> {selectedMaterialForAssign.materialType}</div>
                <div><span className="font-medium">Vehicle Type:</span> {selectedMaterialForAssign.vehicleType}</div>
                <div><span className="font-medium">Category:</span> {selectedMaterialForAssign.category}</div>
              </div>
            </div>

            <form onSubmit={handleAssignSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Driver <span className="text-red-500">*</span>
                </label>
                {driversLoading ? (
                  <div className="text-sm text-gray-500">Loading drivers...</div>
                ) : (
                  <select
                    value={selectedDriverId}
                    onChange={(e) => setSelectedDriverId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Choose a driver...</option>
                    {getCompatibleDrivers(selectedMaterialForAssign).map((driver) => (
                      <option key={driver.driverId} value={driver.driverId}>
                        {driver.fullName} - {driver.vehiclePlateNumber} ({driver.vehicleType})
                        {driver.preferredMaterialType?.includes(selectedMaterialForAssign.materialType) && 
                          " ⭐ Preferred"
                        }
                      </option>
                    ))}
                  </select>
                )}
                {!driversLoading && getCompatibleDrivers(selectedMaterialForAssign).length === 0 && (
                  <div className="text-sm text-amber-600 mt-1">
                    <div className="font-medium mb-1">No compatible drivers found!</div>
                    <div className="text-xs">
                      Reasons could be:
                      <ul className="list-disc list-inside ml-2 mt-1">
                        <li>No drivers with {selectedMaterialForAssign.vehicleType} vehicle type</li>
                        <li>No drivers who prefer {selectedMaterialForAssign.materialType} materials</li>
                        <li>All compatible drivers already have materials assigned</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>

              {/* Show preference information */}
              {getCompatibleDrivers(selectedMaterialForAssign).length > 0 && (
                <div className="text-xs text-gray-500 p-2 bg-gray-50 rounded">
                  <strong>Note:</strong> The backend will assign an available {selectedMaterialForAssign.materialType} material to the selected driver based on their vehicle type and material preferences.
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeAssignModal}
                  className="flex-1 px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assigning || !selectedDriverId || getCompatibleDrivers(selectedMaterialForAssign).length === 0}
                  className="flex-1 px-4 py-2 bg-[#3674B5] text-white rounded-lg hover:bg-[#578FCA] disabled:bg-gray-400"
                >
                  {assigning ? 'Assigning...' : 'Assign Material'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Materials;