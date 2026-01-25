import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { Plus, Edit, X, Trash2, ChevronDown, ToggleLeft, ToggleRight, DollarSign, Calculator, Users, Clock, MapPin, RotateCcw } from 'lucide-react';
import { 
  GET_ALL_DRIVER_SALARY_PRICING,
  DriverSalaryPricing
} from '../../graphql/superadmin/queries/driverSalaryQueries';
import { 
  CREATE_DRIVER_SALARY_PRICING, 
  UPDATE_DRIVER_SALARY_PRICING, 
  DELETE_DRIVER_SALARY_PRICING,
  RESTORE_DRIVER_SALARY_PRICING,
  CreateDriverSalaryPricingInput,
  UpdateDriverSalaryPricingInput
} from '../../graphql/superadmin/mutations/driverSalaryMutations';
import { motion, AnimatePresence } from "framer-motion";
import { AdminLoader } from "../../components/ProtectedRoute";
import ConfirmationModal from "../../components/ConfirmationModal";

const SadminDriverSalary: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPricing, setEditingPricing] = useState<DriverSalaryPricing | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [activeTab, setActiveTab] = useState<'active' | 'inactive' | 'archived'>('active');
  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});
  const [showVehicleDropdown, setShowVehicleDropdown] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showMaterialDropdown, setShowMaterialDropdown] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [pricingToDelete, setPricingToDelete] = useState<DriverSalaryPricing | null>(null);

  // Form states
  const [formData, setFormData] = useState<CreateDriverSalaryPricingInput>({
    vehicleType: 'CAR',
    category: 'DIGITAL',
    materialType: 'LCD',
    distanceRate: '' as any,
    hoursRate: '' as any,
    notes: ''
  });

  // Admin auth (to ensure only SUPERADMIN fires query)
  const { admin } = useAdminAuth();

  // GraphQL Hooks
  const { data, loading, error, refetch } = useQuery(GET_ALL_DRIVER_SALARY_PRICING, {
    skip: !admin || admin.role !== 'SUPERADMIN',
    errorPolicy: 'all',
    fetchPolicy: 'cache-and-network'
  });

  const [createDriverSalaryPricing, { loading: createLoading }] = useMutation(CREATE_DRIVER_SALARY_PRICING, {
    onCompleted: () => {
      setIsModalOpen(false);
      resetForm();
      refetch();
      setErrorMsg('');
    },
    onError: (error) => {
      setErrorMsg(error.message || 'Failed to create driver salary pricing');
    }
  });

  const [updateDriverSalaryPricing, { loading: updateLoading }] = useMutation(UPDATE_DRIVER_SALARY_PRICING, {
    onCompleted: () => {
      setIsModalOpen(false);
      resetForm();
      refetch();
      setErrorMsg('');
    },
    onError: (error) => {
      setErrorMsg(error.message || 'Failed to update driver salary pricing');
    }
  });

  const [deleteDriverSalaryPricing] = useMutation(DELETE_DRIVER_SALARY_PRICING, {
    onCompleted: () => {
      refetch();
    },
    onError: (error) => {
      setErrorMsg(error.message || 'Failed to delete driver salary pricing');
    }
  });

  const [restoreDriverSalaryPricing] = useMutation(RESTORE_DRIVER_SALARY_PRICING, {
    onCompleted: () => {
      refetch();
      setErrorMsg('');
    },
    onError: (error) => {
      setErrorMsg(error.message || 'Failed to restore driver salary pricing');
    }
  });

  const [isRestoring, setIsRestoring] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [pricingToRestore, setPricingToRestore] = useState<DriverSalaryPricing | null>(null);

  const pricingList: DriverSalaryPricing[] = data?.getAllDriverSalaryPricing?.pricingList || [];

  // Debug logging
  console.log('📊 Driver Salary Pricing Debug:', {
    totalPricingList: pricingList.length,
    activeTab,
    pricingList: pricingList.map(p => ({
      id: p.id,
      vehicleType: p.vehicleType,
      materialType: p.materialType,
      isActive: p.isActive,
      isArchived: p.isArchived
    }))
  });

  // Filter pricing - separate archived from inactive
  const filteredPricing = pricingList.filter(pricing => {
    // Ensure boolean values are properly handled (defensive programming)
    // Default isArchived to false if undefined/null (for backward compatibility)
    const isArchived = Boolean(pricing.isArchived === true || pricing.isArchived === 'true');
    // Default isActive to true if undefined/null (for backward compatibility) 
    const isActive = pricing.isActive !== false && pricing.isActive !== 'false' && (pricing.isActive === true || pricing.isActive === 'true' || pricing.isActive === undefined || pricing.isActive === null);
    const isInactive = !isActive && !isArchived;
    
    if (activeTab === 'active') {
      return isActive && !isArchived;
    } else if (activeTab === 'inactive') {
      return isInactive; // Only inactive, NOT archived
    } else if (activeTab === 'archived') {
      return isArchived; // Only archived
    }
    return true;
  });

  console.log('📊 Filtered Pricing:', {
    filteredCount: filteredPricing.length,
    activeTab
  });

  // Reset form function
  const resetForm = () => {
    setFormData({
      vehicleType: 'CAR',
      category: 'DIGITAL',
      materialType: 'LCD',
      distanceRate: '' as any,
      hoursRate: '' as any,
      notes: ''
    });
    setShowVehicleDropdown(false);
    setShowCategoryDropdown(false);
    setShowMaterialDropdown(false);
    setValidationErrors({});
    setEditingPricing(null);
  };

  // Initialize form when editing
  useEffect(() => {
    if (editingPricing) {
      setFormData({
        vehicleType: editingPricing.vehicleType,
        category: editingPricing.category,
        materialType: editingPricing.materialType,
        distanceRate: editingPricing.distanceRate,
        hoursRate: editingPricing.hoursRate,
        notes: editingPricing.notes || ''
      });
    }
  }, [editingPricing]);

  // Auto-determine category based on material type
  useEffect(() => {
    if (formData.materialType === 'LCD' || formData.materialType === 'HEADDRESS') {
      setFormData(prev => ({ ...prev, category: 'DIGITAL' }));
    } else if (['STICKER', 'POSTER'].includes(formData.materialType)) {
      setFormData(prev => ({ ...prev, category: 'NON_DIGITAL' }));
    }
  }, [formData.materialType]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Close all dropdowns if clicking outside any dropdown button or menu
      if (
        !target.closest('.dropdown-button') &&
        !target.closest('.dropdown-menu')
      ) {
        setShowVehicleDropdown(false);
        setShowMaterialDropdown(false);
        setShowCategoryDropdown(false);
      }
    };

    if (showVehicleDropdown || showMaterialDropdown || showCategoryDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showVehicleDropdown, showMaterialDropdown, showCategoryDropdown]);

  // Event handlers
  const handleCreatePricing = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleEditPricing = (pricing: DriverSalaryPricing) => {
    setEditingPricing(pricing);
    setIsModalOpen(true);
  };

  const handleDeletePricing = (pricing: DriverSalaryPricing) => {
    setPricingToDelete(pricing);
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    if (pricingToDelete) {
      deleteDriverSalaryPricing({ variables: { id: pricingToDelete.id } });
      setShowDeleteModal(false);
      setPricingToDelete(null);
    }
  };

  const handleRestorePricing = (pricing: DriverSalaryPricing) => {
    setPricingToRestore(pricing);
    setShowRestoreModal(true);
  };

  const confirmRestore = async () => {
    if (pricingToRestore) {
      setIsRestoring(true);
      try {
        await restoreDriverSalaryPricing({ variables: { id: pricingToRestore.id } });
        setShowRestoreModal(false);
        setPricingToRestore(null);
      } catch (error) {
        console.error('Error restoring pricing:', error);
      } finally {
        setIsRestoring(false);
      }
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setPricingToDelete(null);
  };

  const cancelRestore = () => {
    setShowRestoreModal(false);
    setPricingToRestore(null);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    resetForm();
    setErrorMsg('');
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const errors: { [key: string]: string } = {};
    if (!formData.vehicleType) errors.vehicleType = 'Vehicle Type is required';
    if (!formData.category) errors.category = 'Category is required';
    if (!formData.materialType) errors.materialType = 'Material Type is required';
    
    // Convert empty strings to 0 for validation
    const distanceRate = formData.distanceRate === '' ? 0 : Number(formData.distanceRate);
    const hoursRate = formData.hoursRate === '' ? 0 : Number(formData.hoursRate);
    
    if (distanceRate < 0) errors.distanceRate = 'Distance rate must be non-negative';
    if (hoursRate < 0) errors.hoursRate = 'Hours rate must be non-negative';
  
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
  
    setValidationErrors({});
  
    if (editingPricing) {
      const updateInput: UpdateDriverSalaryPricingInput = {
        distanceRate: distanceRate,
        hoursRate: hoursRate,
        notes: formData.notes
      };
      updateDriverSalaryPricing({ variables: { id: editingPricing.id, input: updateInput } });
    } else {
      const createInput = {
        ...formData,
        distanceRate: distanceRate,
        hoursRate: hoursRate
      };
      createDriverSalaryPricing({ variables: { input: createInput } });
    }
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount);
  };

  if (loading) {
    return <AdminLoader />;
  }

  return (
    <div className="min-h-screen ml-0 lg:ml-60 bg-gray-50">
      {/* Header */}
      <div>
        <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-gray-900 mt-10 sm:mt-8 lg:mt-10">Driver Salary Management</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-0 p-1 rounded-lg w-full mb-4 sm:mb-6">
          {/* Tabs on the left */}
          <div className="flex space-x-1 p-1 overflow-x-auto">
            {["active", "inactive", "archived"].map((tab) => {
              const isActive = activeTab === tab;
              const count =
                tab === "active"
                  ? pricingList.filter((p) => {
                      const pIsActive = p.isActive !== false && p.isActive !== 'false' && (p.isActive === true || p.isActive === 'true' || p.isActive === undefined || p.isActive === null);
                      const pIsArchived = Boolean(p.isArchived === true || p.isArchived === 'true');
                      return pIsActive && !pIsArchived;
                    }).length
                  : tab === "inactive"
                  ? pricingList.filter((p) => {
                      const pIsActive = p.isActive !== false && p.isActive !== 'false' && (p.isActive === true || p.isActive === 'true' || p.isActive === undefined || p.isActive === null);
                      const pIsArchived = Boolean(p.isArchived === true || p.isArchived === 'true');
                      return !pIsActive && !pIsArchived;
                    }).length
                  : pricingList.filter((p) => {
                      const pIsArchived = Boolean(p.isArchived === true || p.isArchived === 'true');
                      return pIsArchived;
                    }).length;

              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as "active" | "inactive" | "archived")}
                  className={`relative group px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors duration-300 whitespace-nowrap ${
                    isActive
                      ? "text-[#3674B5]" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab === "active" ? "Active" : tab === "inactive" ? "Inactive" : "Archived"}

                  {/* Underline animation */}
                  <span
                    className={`absolute bottom-0 left-0 h-0.5 w-full rounded-full transform origin-left transition-transform duration-300 ease-out ${
                      isActive
                        ? "bg-[#3674B5] scale-x-100"
                        : "bg-[#3674B5] scale-x-0 group-hover:scale-x-100"
                    }`}
                  />
                </button>
              );
            })}
          </div>

          {/* Create button on the right - Hidden on mobile */}
          <button
            onClick={handleCreatePricing}
            className="hidden sm:flex bg-[#3674B5] hover:bg-[#1B5087] text-xs sm:text-sm text-white px-3 sm:px-6 py-2 sm:py-3 rounded-md transition-all duration-200 items-center justify-center gap-2 whitespace-nowrap"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">Create Salary Pricing</span>
            <span className="sm:hidden">Create</span>
          </button>
        </div>

        {/* Error Message */}
        {errorMsg && (
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-red-50 border border-red-200 text-red-700 text-sm sm:text-base rounded-xl flex items-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0"></div>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Pricing List */}
        {filteredPricing.length === 0 ? (
          <div className="text-center py-8 sm:py-12">
            <div className="bg-gray-100 rounded-full w-12 h-12 sm:w-16 sm:h-16 flex items-center justify-center mx-auto mb-3 sm:mb-4">
              <DollarSign className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" />
            </div>
            <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">
              No {activeTab} salary pricing configurations found
            </h3>
            <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6 px-4">
              {activeTab === 'active' 
                ? "Create a new salary pricing configuration to get started"
                : "No inactive configurations at the moment"
              }
            </p>
            {activeTab === 'active' && (
              <button
                onClick={handleCreatePricing}
                className="bg-blue-600 text-white text-sm sm:text-base px-4 sm:px-6 py-2 sm:py-3 rounded-xl hover:bg-blue-700 transition-all duration-200 flex items-center gap-2 mx-auto"
              >
                <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                Create Salary Pricing
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
            {filteredPricing.map((pricing) => (
              <div
                key={pricing.id}
                className="bg-white rounded-md p-4 sm:p-6 shadow-md flex flex-col justify-between"
              >
                {/* Content wrapper */}
                <div className="flex-1">
                  {/* Header */}
                  <div className="flex justify-between items-start mb-3 sm:mb-4">
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
                          {pricing.materialType} {pricing.vehicleType === 'E_TRIKE' ? 'E TRIKE' : pricing.vehicleType}
                        </h3>
                        <span
                          className={`px-2 sm:px-3 py-1 rounded-full text-xs font-medium border flex-shrink-0 ${
                            pricing.isActive
                              ? "bg-green-100 text-green-800 border-green-200"
                              : "bg-gray-100 text-gray-800 border-gray-200"
                          }`}
                        >
                          {pricing.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <p className="text-gray-600 text-xs sm:text-sm">{pricing.category === 'NON_DIGITAL' ? 'NON DIGITAL' : pricing.category}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Show Restore button only for archived pricing */}
                      {pricing.isArchived ? (
                        <button
                          onClick={() => handleRestorePricing(pricing)}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Restore Pricing"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => handleEditPricing(pricing)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit Pricing"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeletePricing(pricing)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete Pricing"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Pricing Details */}
                  <div className="space-y-2 sm:space-y-3">
                    <div className="flex justify-between text-xs sm:text-sm">
                      <span className="text-gray-600 flex items-center gap-1">
                        <MapPin className="w-3 h-3 sm:w-4 sm:h-4" />
                        Distance Rate:
                      </span>
                      <span className="font-medium text-green-600">
                        {formatCurrency(pricing.distanceRate)}/km
                      </span>
                    </div>
                    <div className="flex justify-between text-xs sm:text-sm">
                      <span className="text-gray-600 flex items-center gap-1">
                        <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                        Hours Rate:
                      </span>
                      <span className="font-medium text-blue-600">
                        {formatCurrency(pricing.hoursRate)}/hour
                      </span>
                    </div>

                    {pricing.notes && (
                      <div className="pt-2 sm:pt-3">
                        <p className="text-xs sm:text-sm text-black">
                          <span className="font-medium">Notes: {pricing.notes}</span> 
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer — sticks to bottom */}
                <div className="border-t pt-2 sm:pt-3 mt-3 sm:mt-4">
                  <p className="text-[10px] sm:text-xs text-black">
                    Created: <span className="font-medium">{new Date(pricing.createdAt).toLocaleDateString()}</span>
                  </p>
                  {pricing.updatedBy && (
                    <p className="text-[10px] sm:text-xs text-black">
                      Updated: <span className="font-medium">{new Date(pricing.updatedAt).toLocaleDateString()}</span>
                    </p>
                  )}
                  {pricing.isArchived && pricing.scheduledDeletionDate && (
                    <p className="text-[10px] sm:text-xs text-red-600 font-medium">
                      Deletion: <span className="font-medium">{new Date(pricing.scheduledDeletionDate).toLocaleDateString()}</span>
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-50 flex items-center justify-center z-[9999] p-1 sm:p-4">
          <div className="bg-white rounded-md shadow-2xl w-full max-w-lg mx-2 sm:mx-4 p-3 sm:p-6 lg:p-8 max-h-[85vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-2 sm:mb-6">
              <h2 className="text-sm sm:text-xl font-bold text-gray-900 leading-tight">
                {editingPricing ? 'Edit Salary Pricing' : 'Create Salary Pricing'}
              </h2>
              <button onClick={handleModalClose} className="text-gray-400 hover:text-gray-600 flex-shrink-0 ml-2">
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>

            {errorMsg && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-2 sm:p-4 mb-3 sm:mb-6">
                <p className="text-red-800 text-xs sm:text-sm">{errorMsg}</p>
              </div>
            )}

            <form onSubmit={handleFormSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                {/* Vehicle Type Dropdown */}
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                    Vehicle Type
                  </label>
                  <div className="relative w-full">
                    <button
                      type="button"
                      onClick={() => {
                        // Close other dropdowns when opening this one
                        setShowMaterialDropdown(false);
                        setShowCategoryDropdown(false);
                        setShowVehicleDropdown(!showVehicleDropdown);
                      }}
                      disabled={!!editingPricing}
                      className="dropdown-button flex items-center justify-between w-full text-xs text-black rounded-lg pl-6 pr-4 py-3 shadow-md focus:outline-none bg-white gap-2">
                      {formData.vehicleType === 'E_TRIKE' ? 'E TRIKE' : formData.vehicleType || 'Select vehicle type'}
                      <ChevronDown
                        size={16}
                        className={`transform transition-transform duration-200 ${showVehicleDropdown ? "rotate-180" : "rotate-0"}`}
                      />
                    </button>
                    <AnimatePresence>
                      {showVehicleDropdown && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.2 }}
                          className="dropdown-menu absolute z-20 top-full mt-2 w-full rounded-xl shadow-lg bg-white overflow-hidden"
                        >
                          {['CAR', 'MOTORCYCLE', 'BUS', 'JEEP', 'E_TRIKE'].map((option) => (
                            <button
                              key={option}
                              type="button"
                              onClick={() => {
                                setFormData(prev => ({ ...prev, vehicleType: option as any }));
                                setShowVehicleDropdown(false);
                              }}
                              className="block w-full text-left px-4 py-2 text-xs ml-2 text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                            >
                              {option === 'E_TRIKE' ? 'E TRIKE' : option}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  {validationErrors.vehicleType && (
                    <p className="text-red-500 text-xs mt-1">{validationErrors.vehicleType}</p>
                  )}
                </div>

                {/* Material Type Dropdown */}
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                    Material Type
                  </label>
                  <div className="relative w-full">
                    <button
                      type="button"
                      onClick={() => {
                        // Close other dropdowns when opening this one
                        setShowVehicleDropdown(false);
                        setShowCategoryDropdown(false);
                        setShowMaterialDropdown(!showMaterialDropdown);
                      }}
                      disabled={!!editingPricing || !formData.vehicleType}
                      className="dropdown-button flex items-center justify-between w-full text-xs text-black rounded-lg pl-6 pr-4 py-3 shadow-md focus:outline-none bg-white gap-2">
                      {formData.materialType || 'Select material type'}
                      <ChevronDown
                        size={16}
                        className={`transform transition-transform duration-200 ${showMaterialDropdown ? "rotate-180" : "rotate-0"}`}
                      />
                    </button>
                    <AnimatePresence>
                      {showMaterialDropdown && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.2 }}
                          className="dropdown-menu absolute z-20 top-full mt-2 w-full rounded-xl shadow-lg bg-white overflow-hidden"
                        >
                          {(() => {
                            // Define material types based on vehicle type
                            // For MOTORCYCLE and E_TRIKE: Only non-digital materials (POSTER, STICKER)
                            // For CAR, BUS, JEEP: All materials (LCD, HEADDRESS, STICKER, POSTER)
                            const vehicleType = formData.vehicleType;
                            
                            let availableMaterials: string[];
                            
                            if (vehicleType === 'MOTORCYCLE' || vehicleType === 'E_TRIKE') {
                              // Only non-digital materials for MOTORCYCLE and E_TRIKE
                              availableMaterials = ['POSTER', 'STICKER'];
                            } else if (vehicleType === 'CAR') {
                              // CAR can have all materials
                              availableMaterials = ['LCD', 'HEADDRESS', 'STICKER', 'POSTER'];
                            } else if (vehicleType === 'BUS' || vehicleType === 'JEEP') {
                              // BUS and JEEP can have all except HEADDRESS
                              availableMaterials = ['LCD', 'STICKER', 'POSTER'];
                            } else {
                              // Default: no materials available
                              availableMaterials = [];
                            }
                            
                            return availableMaterials.map((option) => (
                              <button
                                key={option}
                                type="button"
                                onClick={() => {
                                  setFormData(prev => ({ ...prev, materialType: option as any }));
                                  setShowMaterialDropdown(false);
                                }}
                                className="block w-full text-left px-4 py-2 text-xs ml-2 text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                              >
                                {option}
                              </button>
                            ));
                          })()}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  {validationErrors.materialType && (
                    <p className="text-red-500 text-xs mt-1">{validationErrors.materialType}</p>
                  )}
                </div>

                
                {/* Category - Auto-determined (Read-only) */}
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                    Category
                  </label>
                  <div className="relative w-full">
                    <div className="flex items-center justify-between w-full text-xs text-black rounded-lg pl-4 sm:pl-6 pr-3 sm:pr-4 py-2 sm:py-3 shadow-md bg-white">
                      {formData.category === 'NON_DIGITAL' ? 'NON DIGITAL' : formData.category || 'Will be determined automatically'}
                    </div>
                    <p className="text-[10px] sm:text-xs text-gray-500 mt-1">
                      Category is automatically determined based on material type
                    </p>
                  </div>
                  {validationErrors.category && (
                    <p className="text-red-500 text-xs mt-1">{validationErrors.category}</p>
                  )}
                </div>

                {/* Distance Rate */}
                <div className="relative">
                  <input
                    type="number"
                    id="distanceRate"
                    placeholder=" "
                    step="0.01"
                    min="0"
                    value={formData.distanceRate}
                    onChange={(e) => setFormData(prev => ({ ...prev, distanceRate: e.target.value as any }))}
                    className={`peer w-full px-0 pt-8 sm:pt-10 pb-2 text-sm sm:text-base text-gray-900 border-b bg-transparent focus:outline-none focus:border-[#3674B5] focus:ring-0 placeholder-transparent transition ${validationErrors.distanceRate ? 'border-red-400' : 'border-gray-300'}`}
                    required
                  />
                  <label
                    htmlFor="distanceRate"
                    className={`absolute left-0 text-gray-700 bg-transparent transition-all duration-200 ${formData.distanceRate !== '' ? 'top-1 text-xs sm:text-sm text-gray-700 font-semibold' : 'peer-placeholder-shown:top-1 peer-placeholder-shown:text-sm sm:peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-700'} peer-focus:top-1 peer-focus:text-xs sm:peer-focus:text-sm peer-focus:text-gray-700 peer-focus:font-semibold`}
                  >
                    Distance Rate (₱/km)
                  </label>
                  {validationErrors.distanceRate && (
                    <p className="text-red-500 text-xs mt-1">{validationErrors.distanceRate}</p>
                  )}
                </div>

                {/* Hours Rate */}
                <div className="relative">
                  <input
                    type="number"
                    id="hoursRate"
                    placeholder=" "
                    step="0.01"
                    min="0"
                    value={formData.hoursRate}
                    onChange={(e) => setFormData(prev => ({ ...prev, hoursRate: e.target.value as any }))}
                    className={`peer w-full px-0 pt-5 pb-2 text-sm sm:text-base text-gray-900 border-b bg-transparent focus:outline-none focus:border-[#3674B5] focus:ring-0 placeholder-transparent transition ${validationErrors.hoursRate ? 'border-red-400' : 'border-gray-300'}`}
                    required
                  />
                  <label
                    htmlFor="hoursRate"
                    className={`absolute left-0 text-gray-700 bg-transparent transition-all duration-200 ${formData.hoursRate !== '' ? '-top-2 text-xs sm:text-sm text-gray-700 font-semibold' : 'peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm sm:peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-700'} peer-focus:-top-2 peer-focus:text-xs sm:peer-focus:text-sm peer-focus:text-gray-700 peer-focus:font-semibold`}
                  >
                    Hours Rate (₱/hour)
                  </label>
                  {validationErrors.hoursRate && (
                    <p className="text-red-500 text-xs mt-1">{validationErrors.hoursRate}</p>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div className="mt-4 sm:mt-6">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 text-sm sm:text-base rounded-lg focus:outline-none shadow-md"
                  placeholder="Add any additional notes about this pricing configuration..."
                />
              </div>

              {/* Form Actions */}
              <div className="flex flex-col sm:flex-row justify-between gap-3 sm:gap-0 mt-6 sm:mt-8 space-y-0 sm:space-x-3">
                <button
                  type="button"
                  onClick={handleModalClose}
                  className="px-4 py-2 text-sm sm:text-base text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed order-2 sm:order-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading || updateLoading}
                  className="px-4 sm:px-6 py-2 text-sm sm:text-base bg-[#3674B5] hover:bg-[#1B5087] text-white rounded-md disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors order-1 sm:order-2"
                >
                  {createLoading || updateLoading ? 'Saving...' : editingPricing ? (
                    <span className="hidden sm:inline">Update Pricing</span>
                  ) : (
                    <span className="hidden sm:inline">Create Pricing</span>
                  )}
                  {createLoading || updateLoading ? 'Saving...' : editingPricing ? (
                    <span className="sm:hidden">Update</span>
                  ) : (
                    <span className="sm:hidden">Create</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={cancelDelete}
        onConfirm={confirmDelete}
        title="Delete Salary Pricing"
        message={pricingToDelete ? `Are you sure you want to delete the salary pricing for ${pricingToDelete.displayName}?` : ''}
        confirmText="Delete"
        cancelText="Cancel"
        confirmButtonClass="bg-red-600 hover:bg-red-700"
      />

      {/* Restore Confirmation Modal */}
      <ConfirmationModal
        isOpen={showRestoreModal}
        onClose={cancelRestore}
        onConfirm={confirmRestore}
        title="Restore Salary Pricing"
        message={pricingToRestore ? `Are you sure you want to restore the salary pricing for ${pricingToRestore.displayName}?` : ''}
        confirmText="Restore"
        cancelText="Cancel"
        confirmButtonClass="bg-green-600 hover:bg-green-700"
      />

      {/* Floating Action Button - Mobile Only */}
      <button
        onClick={handleCreatePricing}
        className="sm:hidden fixed bottom-6 right-6 z-50 w-14 h-14 bg-[#3674B5] hover:bg-[#3674B5]/90 text-white rounded-full shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95"
        aria-label="Create Salary Pricing"
      >
        <Plus className="w-6 h-6" />
      </button>
    </div>
  );
};

export default SadminDriverSalary;
