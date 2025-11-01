import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { Plus, Edit, X, Trash2, ChevronDown, ToggleLeft, ToggleRight, DollarSign, Calculator, Users, Clock, MapPin } from 'lucide-react';
import { 
  GET_ALL_DRIVER_SALARY_PRICING,
  DriverSalaryPricing
} from '../../graphql/superadmin/queries/driverSalaryQueries';
import { 
  CREATE_DRIVER_SALARY_PRICING, 
  UPDATE_DRIVER_SALARY_PRICING, 
  DELETE_DRIVER_SALARY_PRICING,
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
  const [activeTab, setActiveTab] = useState<'active' | 'inactive'>('active');
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
    distanceRate: 0,
    hoursRate: 0,
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


  const pricingList: DriverSalaryPricing[] = data?.getAllDriverSalaryPricing?.pricingList || [];

  // Filter pricing by active status
  const filteredPricing = pricingList.filter(pricing => 
    activeTab === 'active' ? pricing.isActive : !pricing.isActive
  );

  // Reset form function
  const resetForm = () => {
    setFormData({
      vehicleType: 'CAR',
      category: 'DIGITAL',
      materialType: 'LCD',
      distanceRate: 0,
      hoursRate: 0,
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

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setPricingToDelete(null);
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
    if (formData.distanceRate < 0) errors.distanceRate = 'Distance rate must be non-negative';
    if (formData.hoursRate < 0) errors.hoursRate = 'Hours rate must be non-negative';
  
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
  
    setValidationErrors({});
  
    if (editingPricing) {
      const updateInput: UpdateDriverSalaryPricingInput = {
        distanceRate: formData.distanceRate,
        hoursRate: formData.hoursRate,
        notes: formData.notes
      };
      updateDriverSalaryPricing({ variables: { id: editingPricing.id, input: updateInput } });
    } else {
      createDriverSalaryPricing({ variables: { input: formData } });
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
    <div className="min-h-screen ml-60 bg-gray-50">
      {/* Header */}
      <div>
        <div className="px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-semibold text-gray-900 mt-5">Driver Salary Management</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-8">
          <div className="bg-white rounded-md p-6 shadow-md">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-full">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Configurations</p>
                <p className="text-2xl font-bold text-gray-900">{pricingList.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-md p-6 shadow-md">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-full">
                <Calculator className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Configurations</p>
                <p className="text-2xl font-bold text-gray-900">{pricingList.filter(p => p.isActive).length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-md p-6 shadow-md">
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 rounded-full">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Vehicle Types</p>
                <p className="text-2xl font-bold text-gray-900">{new Set(pricingList.map(p => p.vehicleType)).size}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-md p-6 shadow-md">
            <div className="flex items-center">
              <div className="p-3 bg-orange-100 rounded-full">
                <Clock className="w-6 h-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Material Types</p>
                <p className="text-2xl font-bold text-gray-900">{new Set(pricingList.map(p => p.materialType)).size}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center justify-between p-1 rounded-lg w-full mb-6">
          {/* Tabs on the left */}
          <div className="flex space-x-1 p-1">
            {["active", "inactive"].map((tab) => {
              const isActive = activeTab === tab;
              const count =
                tab === "active"
                  ? pricingList.filter((p) => p.isActive).length
                  : pricingList.filter((p) => !p.isActive).length;

              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as "active" | "inactive")}
                  className={`relative group px-4 py-2 rounded-md text-sm font-medium transition-colors duration-300 ${
                    isActive
                      ? "text-blue-600" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab === "active" ? "Active" : "Inactive"}

                  {/* Underline animation */}
                  <span
                    className={`absolute bottom-0 left-0 h-0.5 w-full rounded-full transform origin-left transition-transform duration-300 ease-out ${
                      isActive
                        ? "bg-blue-500 scale-x-100"
                        : "bg-blue-500 scale-x-0 group-hover:scale-x-100"
                    }`}
                  />
                </button>
              );
            })}
          </div>

          {/* Create button on the right */}
          <button
            onClick={handleCreatePricing}
            className="bg-[#3674B5] hover:bg-[#1B5087] text-sm text-white px-6 py-3 rounded-md transition-all duration-200 flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Create Salary Pricing
          </button>
        </div>

        {/* Error Message */}
        {errorMsg && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            {errorMsg}
          </div>
        )}

        {/* Pricing List */}
        {filteredPricing.length === 0 ? (
          <div className="text-center py-12">
            <div className="bg-gray-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <DollarSign className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No {activeTab} salary pricing configurations found
            </h3>
            <p className="text-gray-600 mb-6">
              {activeTab === 'active' 
                ? "Create a new salary pricing configuration to get started"
                : "No inactive configurations at the moment"
              }
            </p>
            {activeTab === 'active' && (
              <button
                onClick={handleCreatePricing}
                className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-all duration-200 flex items-center gap-2 mx-auto"
              >
                <Plus className="w-5 h-5" />
                Create Salary Pricing
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
            {filteredPricing.map((pricing) => (
              <div
                key={pricing.id}
                className="bg-white rounded-md p-6 shadow-md flex flex-col justify-between"
              >
                {/* Content wrapper */}
                <div className="flex-1">
                  {/* Header */}
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {pricing.materialType} {pricing.vehicleType === 'E_TRIKE' ? 'E TRIKE' : pricing.vehicleType}
                        </h3>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium border ${
                            pricing.isActive
                              ? "bg-green-100 text-green-800 border-green-200"
                              : "bg-gray-100 text-gray-800 border-gray-200"
                          }`}
                        >
                          {pricing.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <p className="text-gray-600 text-sm">{pricing.category === 'NON_DIGITAL' ? 'NON DIGITAL' : pricing.category}</p>
                    </div>
                    <div className="flex items-center gap-2">
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
                    </div>
                  </div>

                  {/* Pricing Details */}
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        Distance Rate:
                      </span>
                      <span className="font-medium text-green-600">
                        {formatCurrency(pricing.distanceRate)}/km
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        Hours Rate:
                      </span>
                      <span className="font-medium text-blue-600">
                        {formatCurrency(pricing.hoursRate)}/hour
                      </span>
                    </div>

                    {pricing.notes && (
                      <div className="pt-3">
                        <p className="text-sm text-black">
                          <span className="font-medium">Notes: {pricing.notes}</span> 
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer — sticks to bottom */}
                <div className="border-t pt-3 mt-4">
                  <p className="text-xs text-black">
                    Created: <span className="font-medium">{new Date(pricing.createdAt).toLocaleDateString()}</span>
                  </p>
                  {pricing.updatedBy && (
                    <p className="text-xs text-black">
                      Updated: <span className="font-medium">{new Date(pricing.updatedAt).toLocaleDateString()}</span>
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
        <div className="fixed inset-0 bg-gray-500 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-md shadow-2xl w-full max-w-lg mx-4 p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                {editingPricing ? 'Edit Salary Pricing' : 'Create Salary Pricing'}
              </h2>
              <button onClick={handleModalClose} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            {errorMsg && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <p className="text-red-800 text-sm">{errorMsg}</p>
              </div>
            )}

            <form onSubmit={handleFormSubmit}>
              <div className="grid md:grid-cols-2 gap-6">
                {/* Vehicle Type Dropdown */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
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

                {/* Category - Auto-determined (Read-only) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category
                  </label>
                  <div className="relative w-full">
                    <div className="flex items-center justify-between w-full text-xs text-black rounded-lg pl-6 pr-4 py-3 shadow-md bg-gray-50 border border-gray-300">
                      {formData.category === 'NON_DIGITAL' ? 'NON DIGITAL' : formData.category || 'Will be determined automatically'}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Category is automatically determined based on material type
                    </p>
                  </div>
                  {validationErrors.category && (
                    <p className="text-red-500 text-xs mt-1">{validationErrors.category}</p>
                  )}
                </div>

                {/* Material Type Dropdown */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
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

                {/* Distance Rate */}
                <div className="relative">
                  <input
                    type="number"
                    id="distanceRate"
                    placeholder=" "
                    step="0.01"
                    min="0"
                    value={formData.distanceRate}
                    onChange={(e) => setFormData(prev => ({ ...prev, distanceRate: parseFloat(e.target.value) || 0 }))}
                    className={`peer w-full px-0 pt-5 pb-2 text-gray-900 border-b bg-transparent focus:outline-none focus:border-blue-500 focus:ring-0 placeholder-transparent transition ${validationErrors.distanceRate ? 'border-red-400' : 'border-gray-300'}`}
                    required
                  />
                  <label
                    htmlFor="distanceRate"
                    className={`absolute left-0 text-gray-700 bg-transparent transition-all duration-200 ${formData.distanceRate ? '-top-2 text-sm text-gray-700 font-semibold' : 'peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-700'} peer-focus:-top-2 peer-focus:text-sm peer-focus:text-gray-700 peer-focus:font-semibold`}
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
                    onChange={(e) => setFormData(prev => ({ ...prev, hoursRate: parseFloat(e.target.value) || 0 }))}
                    className={`peer w-full px-0 pt-5 pb-2 text-gray-900 border-b bg-transparent focus:outline-none focus:border-blue-500 focus:ring-0 placeholder-transparent transition ${validationErrors.hoursRate ? 'border-red-400' : 'border-gray-300'}`}
                    required
                  />
                  <label
                    htmlFor="hoursRate"
                    className={`absolute left-0 text-gray-700 bg-transparent transition-all duration-200 ${formData.hoursRate ? '-top-2 text-sm text-gray-700 font-semibold' : 'peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-700'} peer-focus:-top-2 peer-focus:text-sm peer-focus:text-gray-700 peer-focus:font-semibold`}
                  >
                    Hours Rate (₱/hour)
                  </label>
                  {validationErrors.hoursRate && (
                    <p className="text-red-500 text-xs mt-1">{validationErrors.hoursRate}</p>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg focus:outline-none shadow-md"
                  placeholder="Add any additional notes about this pricing configuration..."
                />
              </div>

              {/* Form Actions */}
              <div className="flex justify-between mt-8 space-x-3">
                <button
                  type="button"
                  onClick={handleModalClose}
                  className="px-4 py-2 text-gray-700 rounded-lg border hover:bg-gray-50 hover:text-gray-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading || updateLoading}
                  className="px-4 py-2 bg-[#3674B5] hover:bg-[#1B5087] text-white rounded-md disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {createLoading || updateLoading ? 'Saving...' : editingPricing ? 'Update Pricing' : 'Create Pricing'}
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
    </div>
  );
};

export default SadminDriverSalary;
