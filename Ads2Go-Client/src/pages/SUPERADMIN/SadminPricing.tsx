import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { Plus, Edit, X, Trash2, ChevronDown, PowerOff, Power, DollarSign, RotateCcw } from 'lucide-react';
import { 
  GET_ALL_PRICING_CONFIGS, 
  PricingConfig
} from '../../graphql/superadmin/queries/pricingConfigQueries';
import { 
  CREATE_PRICING_CONFIG, 
  UPDATE_PRICING_CONFIG, 
  DELETE_PRICING_CONFIG,
  RESTORE_PRICING_CONFIG,
  TOGGLE_PRICING_CONFIG_STATUS,
  PricingConfigInput,
  PricingConfigUpdateInput
} from '../../graphql/superadmin/mutations/pricingConfigMutations';
import { 
  GET_GLOBAL_PRICING_MULTIPLIERS,
  GlobalPricingMultipliers,
  GlobalPricingMultipliersInput,
  AdLengthMultipliers,
  DurationDiscountMultipliers
} from '../../graphql/superadmin/queries/globalPricingMultipliersQueries';
import { 
  UPDATE_GLOBAL_PRICING_MULTIPLIERS
} from '../../graphql/superadmin/mutations/globalPricingMultipliersMutations';
import { motion, AnimatePresence } from "framer-motion";
import { AdminLoader } from "../../components/ProtectedRoute";
import ConfirmationModal from "../../components/ConfirmationModal";

const SadminPricing: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<PricingConfig | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [activeTab, setActiveTab] = useState<'active' | 'inactive' | 'archived'>('active');
  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});
  const [showVehicleDropdown, setShowVehicleDropdown] = useState(false);
  const [showMaterialDropdown, setShowMaterialDropdown] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [configToDelete, setConfigToDelete] = useState<PricingConfig | null>(null);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [configToRestore, setConfigToRestore] = useState<PricingConfig | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [multipliersFormData, setMultipliersFormData] = useState<GlobalPricingMultipliersInput>({
    adLengthMultipliers: {
      seconds20: 1.0,
      seconds40: 2.0,
      seconds60: 3.0
    },
    durationDiscountMultipliers: {
      months1: 1.0,
      months2: 0.95,
      months3: 0.95,
      months4: 0.90,
      months5: 0.90,
      months6: 0.85
    }
  });

  // Form states
  const [formData, setFormData] = useState<PricingConfigInput>({
    materialType: '',
    vehicleType: '',
    category: '',
    basePrice: 0,
    minAdLengthSeconds: 20,
    maxAdLengthSeconds: 60,
    isActive: true
  });

  // Admin auth (to ensure only SUPERADMIN fires query)
  const { admin } = useAdminAuth();

  // GraphQL Hooks
  const { data, loading, refetch } = useQuery(GET_ALL_PRICING_CONFIGS, {
    skip: !admin || admin.role !== 'SUPERADMIN',
    errorPolicy: 'all',
    fetchPolicy: 'cache-and-network'
  });

  const { data: multipliersData, loading: multipliersLoading, refetch: refetchMultipliers } = useQuery(GET_GLOBAL_PRICING_MULTIPLIERS, {
    skip: !admin || admin.role !== 'SUPERADMIN',
    errorPolicy: 'all',
    fetchPolicy: 'cache-and-network'
  });

  const [updateGlobalMultipliers] = useMutation(UPDATE_GLOBAL_PRICING_MULTIPLIERS, {
    onError: (error) => {
      setErrorMsg(error.message || 'Failed to update global multipliers');
    }
  });

  const [createPricingConfig, { loading: createLoading }] = useMutation(CREATE_PRICING_CONFIG, {
    onCompleted: () => {
      setIsModalOpen(false);
      resetForm();
      refetch();
      setErrorMsg('');
    },
    onError: (error) => {
      setErrorMsg(error.message || 'Failed to create pricing configuration');
    }
  });

  const [updatePricingConfig, { loading: updateLoading }] = useMutation(UPDATE_PRICING_CONFIG, {
    onCompleted: () => {
      setIsModalOpen(false);
      resetForm();
      refetch();
      setErrorMsg('');
    },
    onError: (error) => {
      setErrorMsg(error.message || 'Failed to update pricing configuration');
    }
  });

  const [deletePricingConfig] = useMutation(DELETE_PRICING_CONFIG, {
    onCompleted: () => {
      refetch();
      setShowDeleteModal(false);
      setConfigToDelete(null);
      setErrorMsg('');
    },
    onError: (error) => {
      setErrorMsg(error.message || 'Failed to delete pricing configuration');
    }
  });

  const [restorePricingConfig] = useMutation(RESTORE_PRICING_CONFIG, {
    onCompleted: () => {
      refetch();
      setShowRestoreModal(false);
      setConfigToRestore(null);
      setErrorMsg('');
    },
    onError: (error) => {
      setErrorMsg(error.message || 'Failed to restore pricing configuration');
    }
  });

  const [togglePricingConfigStatus] = useMutation(TOGGLE_PRICING_CONFIG_STATUS, {
    onCompleted: () => {
      refetch();
    },
    onError: (error) => {
      setErrorMsg(error.message || 'Failed to toggle pricing configuration status');
    }
  });

  const configs: PricingConfig[] = data?.getAllPricingConfigs || [];

  // Filter configs - separate archived from inactive
  const filteredConfigs = configs.filter(config => {
    // Ensure boolean values are properly handled (defensive programming)
    const isArchived = Boolean(config.isArchived === true || String(config.isArchived) === 'true');
    const isActive = config.isActive !== false && String(config.isActive) !== 'false' && (config.isActive === true || String(config.isActive) === 'true' || config.isActive === undefined || config.isActive === null);
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

  // Reset form function
  const resetForm = () => {
    setFormData({
      materialType: '',
      vehicleType: '',
      category: '',
      basePrice: 0,
      minAdLengthSeconds: 20,
      maxAdLengthSeconds: 60,
      isActive: true
    });
    setShowVehicleDropdown(false);
    setShowMaterialDropdown(false);
    setValidationErrors({});
    setEditingConfig(null);
  };

  // Initialize form when editing
  useEffect(() => {
    if (editingConfig) {
      setFormData({
        materialType: editingConfig.materialType,
        vehicleType: editingConfig.vehicleType,
        category: editingConfig.category,
        basePrice: editingConfig.basePrice,
        minAdLengthSeconds: editingConfig.minAdLengthSeconds,
        maxAdLengthSeconds: editingConfig.maxAdLengthSeconds,
        isActive: editingConfig.isActive
      });
    }
  }, [editingConfig]);

  // Initialize multipliers form when pricing modal opens
  useEffect(() => {
    if (isModalOpen && multipliersData?.getGlobalPricingMultipliers) {
      const multipliers = multipliersData.getGlobalPricingMultipliers;
      // Strip __typename from Apollo cache objects
      const { __typename: _, ...adLengthMultipliers } = multipliers.adLengthMultipliers;
      const { __typename: __, ...durationDiscountMultipliers } = multipliers.durationDiscountMultipliers;
      setMultipliersFormData({
        adLengthMultipliers: adLengthMultipliers as any,
        durationDiscountMultipliers: durationDiscountMultipliers as any
      });
    }
  }, [isModalOpen, multipliersData]);

  // Auto-determine category based on material type
  useEffect(() => {
    if (formData.materialType === 'LCD') {
      setFormData(prev => ({ ...prev, category: 'DIGITAL' }));
    } else if (formData.materialType === 'HEADDRESS') {
      setFormData(prev => ({ ...prev, category: 'DIGITAL' }));
    }
  }, [formData.materialType]);

  // Event handlers
  const handleCreateConfig = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleEditConfig = (config: PricingConfig) => {
    setEditingConfig(config);
    setIsModalOpen(true);
  };

  const handleDeleteConfig = (config: PricingConfig) => {
    setConfigToDelete(config);
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    if (configToDelete) {
      deletePricingConfig({ variables: { id: configToDelete.id } });
      setShowDeleteModal(false);
      setConfigToDelete(null);
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setConfigToDelete(null);
  };

  const handleRestoreConfig = (config: PricingConfig) => {
    setConfigToRestore(config);
    setShowRestoreModal(true);
  };

  const confirmRestore = async () => {
    if (configToRestore) {
      setIsRestoring(true);
      try {
        await restorePricingConfig({ variables: { id: configToRestore.id } });
        setShowRestoreModal(false);
        setConfigToRestore(null);
      } catch (error) {
        console.error('Error restoring config:', error);
      } finally {
        setIsRestoring(false);
      }
    }
  };

  const cancelRestore = () => {
    setShowRestoreModal(false);
    setConfigToRestore(null);
  };

  const handleToggleStatus = (config: PricingConfig) => {
    togglePricingConfigStatus({ variables: { id: config.id } });
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    resetForm();
    setErrorMsg('');
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const errors: { [key: string]: string } = {};
    if (!formData.vehicleType) errors.vehicleType = 'Vehicle Type is required';
    if (!formData.materialType) errors.materialType = 'Material Type is required';
    if (!formData.category) errors.category = 'Category is required';
    if (!formData.basePrice || formData.basePrice <= 0) errors.basePrice = 'Base Price must be greater than 0';
  
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
  
    setValidationErrors({});
  
    // Save duration discount multipliers first (always, since they're global)
    try {
      // Strip __typename from the multipliers object before sending to GraphQL
      const { __typename, ...cleanDurationMultipliers } = multipliersFormData.durationDiscountMultipliers as any;
      await updateGlobalMultipliers({ 
        variables: { 
          input: { 
            durationDiscountMultipliers: cleanDurationMultipliers 
          } 
        } 
      });
    } catch (error) {
      console.error('Failed to update multipliers:', error);
      setErrorMsg('Failed to update duration discount multipliers');
      return;
    }

    // Then save pricing config
    if (editingConfig) {
      const updateInput: PricingConfigUpdateInput = {
        basePrice: formData.basePrice,
        minAdLengthSeconds: formData.minAdLengthSeconds,
        maxAdLengthSeconds: formData.maxAdLengthSeconds,
        isActive: formData.isActive
      };
      updatePricingConfig({ variables: { id: editingConfig.id, input: updateInput } });
    } else {
      createPricingConfig({ variables: { input: formData } });
    }
  };

  // Removed pricing tier management functions - now using basePrice instead
  // Removed getMaxDevices - maxDevices field removed from pricing config

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
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-gray-900 mt-10 sm:mt-8 lg:mt-10">Pricing Management</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8">
        {/* Tabs */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-0 p-1 w-full mb-4 sm:mb-6">
          {/* Tabs on the left */}
          <div className="flex space-x-1 rounded-lg p-1 overflow-x-auto">
            {["active", "inactive", "archived"].map((tab) => {
              const isActive = activeTab === tab;
              const count =
                tab === "active"
                  ? configs.filter((c) => {
                      const cIsActive = c.isActive !== false && String(c.isActive) !== 'false' && (c.isActive === true || String(c.isActive) === 'true' || c.isActive === undefined || c.isActive === null);
                      const cIsArchived = Boolean(c.isArchived === true || String(c.isArchived) === 'true');
                      return cIsActive && !cIsArchived;
                    }).length
                  : tab === "inactive"
                  ? configs.filter((c) => {
                      const cIsActive = c.isActive !== false && String(c.isActive) !== 'false' && (c.isActive === true || String(c.isActive) === 'true' || c.isActive === undefined || c.isActive === null);
                      const cIsArchived = Boolean(c.isArchived === true || String(c.isArchived) === 'true');
                      return !cIsActive && !cIsArchived;
                    }).length
                  : configs.filter((c) => {
                      const cIsArchived = Boolean(c.isArchived === true || String(c.isArchived) === 'true');
                      return cIsArchived;
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
            onClick={handleCreateConfig}
            className="hidden sm:flex bg-[#3674B5] hover:bg-[#3674B5]/80 text-xs sm:text-sm text-white px-3 sm:px-6 py-2 sm:py-3 rounded-md transition-all duration-200 items-center justify-center gap-2 whitespace-nowrap"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">Create Pricing Config</span>
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

        {/* Configurations List */}
        {filteredConfigs.length === 0 ? (
          <div className="text-center py-8 sm:py-12">
            <div className="w-12 h-12 sm:w-16 sm:h-16 flex items-center justify-center mx-auto mb-3 sm:mb-4">
              <DollarSign className="w-6 h-6 sm:w-8 sm:h-8 text-black/80" />
            </div>
            <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">
              No {activeTab} pricing configurations found
            </h3>
            <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6 px-4">
              {activeTab === 'active' 
                ? "Create a new pricing configuration to get started"
                : activeTab === 'inactive'
                ? "No inactive configurations at the moment"
                : "No archived configurations at the moment"
              }
            </p>
            {activeTab === 'active' && (
              <button
                onClick={handleCreateConfig}
                className="bg-[#3674B5] text-white text-sm sm:text-base px-4 sm:px-6 py-2 sm:py-3 rounded-xl hover:bg-blue-700 transition-all duration-200 flex items-center gap-2 mx-auto"
              >
                <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                Create Pricing Config
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
            {filteredConfigs.map((config) => (
              <div key={config.id} className="bg-white rounded-md p-4 sm:p-6 shadow-md">
                {/* Header */}
                <div className="flex justify-between items-start mb-3 sm:mb-4">
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
                        {config.materialType} {config.vehicleType}
                      </h3>
                      <span className={`px-2 sm:px-3 py-1 rounded-full text-xs font-medium border flex-shrink-0 ${
                        config.isActive 
                          ? 'bg-green-100 text-green-800 border-green-200'
                          : 'bg-gray-100 text-gray-800 border-gray-200'
                      }`}>
                        {config.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-gray-600 text-xs sm:text-sm">{config.category}</p>
                  </div>
                  <div className="flex items-center flex-shrink-0">
                    {/* Show Restore button only for archived config */}
                    {config.isArchived ? (
                      <button
                        onClick={() => handleRestoreConfig(config)}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Restore Configuration"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => handleToggleStatus(config)}
                          className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                          title={config.isActive ? 'Deactivate' : 'Activate'}
                        >
                          {config.isActive ? (
                            <Power className="w-4 h-4 text-green-600" />
                          ) : (
                            <PowerOff className="w-4 h-4 text-gray-400" />
                          )}
                        </button>
                        <button
                          onClick={() => handleEditConfig(config)}
                          className="p-2 text-[#3674B5] hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit Configuration"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteConfig(config)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete Configuration"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Configuration Details */}
                <div className="space-y-2 sm:space-y-3">
                  {/* Base Price */}
                  <div className="border-t pt-2 sm:pt-3">
                    <div className="flex justify-between text-xs sm:text-sm">
                      <span className="text-gray-600">Base Price:</span>
                      <span className="font-medium text-green-600">
                        {formatCurrency(config.basePrice)}
                      </span>
                    </div>
                    <p className="text-[10px] sm:text-xs text-gray-500 mt-1">
                      For 20-second ad / 1 month / 1 device
                    </p>
                  </div>
                </div>

                {/* Footer — shows deletion date for archived items */}
                {config.isArchived && config.scheduledDeletionDate && (
                  <div className="border-t pt-2 sm:pt-3 mt-3 sm:mt-4">
                    <p className="text-[10px] sm:text-xs text-red-600 font-medium">
                      Scheduled for deletion: <span className="font-medium">
                        {(() => {
                          try {
                            const date = new Date(config.scheduledDeletionDate);
                            if (isNaN(date.getTime())) return 'N/A';
                            return date.toLocaleDateString();
                          } catch {
                            return 'N/A';
                          }
                        })()}
                      </span>
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {isModalOpen && (
      <div className="fixed inset-0 bg-gray-500 bg-opacity-50 flex items-center justify-center z-[9999] p-1 sm:p-4">
        <div className="bg-white rounded-md shadow-md w-full max-w-2xl mx-2 sm:mx-4 p-3 sm:p-6 lg:p-8 max-h-[85vh] sm:max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-2 sm:mb-6">
            <h2 className="text-sm sm:text-xl font-bold text-gray-900 leading-tight">
              {editingConfig ? 'Edit Pricing Configuration' : 'Create Pricing Configuration'}
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
                    onClick={() => setShowVehicleDropdown(!showVehicleDropdown)}
                    disabled={!!editingConfig}
                    className="flex items-center justify-between w-full text-xs text-black rounded-lg pl-6 pr-4 py-3 shadow-md focus:outline-none bg-white gap-2">
                    {formData.vehicleType || 'Select vehicle type'}
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
                        className="absolute z-10 top-full mt-2 w-full rounded-xl shadow-lg bg-white overflow-hidden"
                      >
                        {['CAR', 'MOTORCYCLE'].map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => {
                              setFormData(prev => ({ ...prev, vehicleType: option }));
                              setShowVehicleDropdown(false);
                            }}
                            className="block w-full text-left px-4 py-2 text-xs ml-2 text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                          >
                            {option}
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
                    onClick={() => setShowMaterialDropdown(!showMaterialDropdown)}
                    disabled={!!editingConfig || !formData.vehicleType}
                    className="flex items-center justify-between w-full text-xs text-black rounded-lg pl-6 pr-4 py-3 shadow-md focus:outline-none bg-white gap-2"
                  >
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
                        className="absolute z-10 top-full mt-2 w-full rounded-xl shadow-lg bg-white overflow-hidden"
                      >
                        {(formData.vehicleType === 'CAR' ? ['LCD', 'HEADDRESS'] : formData.vehicleType === 'MOTORCYCLE' ? ['LCD'] : []).map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => {
                              setFormData(prev => ({ ...prev, materialType: option }));
                              setShowMaterialDropdown(false);
                            }}
                            className="block w-full text-left px-4 py-2 text-xs ml-2 text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                          >
                            {option}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                {validationErrors.materialType && (
                  <p className="text-red-500 text-xs mt-1">{validationErrors.materialType}</p>
                )}
              </div>

              {/* Category (Auto-determined) */}
              <div className="relative">
                <div className="w-full px-0 pt-5 pb-2 text-gray-900 border-b bg-transparent border-gray-300 focus:outline-none focus:border-[#3674B5] focus:ring-0 transition">
                  <div className="text-xs sm:text-sm text-gray-600">
                    {formData.category || 'Will be determined automatically'}
                  </div>
                </div>
                <label className="absolute left-0 -top-2 text-xs sm:text-sm text-gray-700 font-semibold">
                  Category
                </label>
                {validationErrors.category && (
                  <p className="text-red-500 text-xs mt-1">{validationErrors.category}</p>
                )}
              </div>

            </div>

            {/* Base Price Input */}
            <div className="mt-4 sm:mt-6">
              <div className="relative">
                <input
                  type="number"
                  id="basePrice"
                  placeholder=" "
                  step="0.01"
                  min="0.01"
                  value={formData.basePrice || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData(prev => ({ ...prev, basePrice: val === '' ? 0 : parseFloat(val) }));
                  }}
                  className={`peer w-full px-0 pt-5 pb-2 text-sm sm:text-base text-gray-900 border-b bg-transparent focus:outline-none focus:border-[#3674B5] focus:ring-0 placeholder-transparent transition ${validationErrors.basePrice ? 'border-red-400' : 'border-gray-300'}`}
                  required
                />
                <label
                  htmlFor="basePrice"
                  className={`absolute left-0 text-gray-700 bg-transparent transition-all duration-200 ${formData.basePrice ? '-top-2 text-xs sm:text-sm text-gray-700 font-semibold' : 'peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm sm:peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-700'} peer-focus:-top-2 peer-focus:text-xs sm:peer-focus:text-sm peer-focus:text-gray-700 peer-focus:font-semibold`}
                >
                  Base Price (for 20-second ad / 1 month / 1 device)
                </label>
                <span className="text-[10px] sm:text-xs text-[#3674B5] mt-1 block">
                  This is the starting price for the smallest possible ad package. For example: $50.00 for Car/LCD, $30.00 for Car/Headdress.
                </span>
                {validationErrors.basePrice && (
                  <p className="text-red-500 text-xs mt-1">{validationErrors.basePrice}</p>
                )}
              </div>

              {/* Ad Length Multipliers - Display Only (Hardcoded) */}
              <div className="mt-4 sm:mt-6 border-t pt-4 sm:pt-6">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">Ad Length Multipliers</h3>
                <p className="text-xs sm:text-sm text-gray-600 mb-3">
                  These multipliers are automatically calculated based on ad length and cannot be changed.
                </p>
                <div className="bg-gray-50 rounded-md p-3 sm:p-4 space-y-2 sm:space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs sm:text-sm text-gray-700">20-second Ad:</span>
                    <span className="text-xs sm:text-sm font-semibold text-gray-900">1.0x (Base)</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs sm:text-sm text-gray-700">40-second Ad:</span>
                    <span className="text-xs sm:text-sm font-semibold text-gray-900">2.0x (Double)</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs sm:text-sm text-gray-700">60-second Ad:</span>
                    <span className="text-xs sm:text-sm font-semibold text-gray-900">3.0x (Triple)</span>
                  </div>
                </div>
                <p className="text-[10px] sm:text-xs text-gray-500 mt-2">
                  These values are fixed because a 40-second ad uses 2x the screen time, and a 60-second ad uses 3x the screen time.
                </p>
              </div>

              {/* Duration Discount Multipliers */}
              <div className="mt-4 sm:mt-6 border-t pt-4 sm:pt-6">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">Duration Discount Multipliers</h3>
                <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">
                  These multipliers provide discounts for longer durations. 1 month is the base (1.0 = no discount).
                </p>
                <div className="space-y-3 sm:space-y-4">
                  {([
                    { key: 'months1', months: '1' },
                    { key: 'months2', months: '2' },
                    { key: 'months3', months: '3' },
                    { key: 'months4', months: '4' },
                    { key: 'months5', months: '5' },
                    { key: 'months6', months: '6' }
                  ] as const).map(({ key, months }) => (
                    <div key={key} className="relative">
                      <input
                        type="number"
                        id={`duration_${months}`}
                        placeholder=" "
                        step="0.01"
                        min="0"
                        max="1"
                        value={multipliersFormData.durationDiscountMultipliers[key] || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '') {
                            // Allow clearing the field temporarily
                            setMultipliersFormData(prev => ({
                              ...prev,
                              durationDiscountMultipliers: {
                                ...prev.durationDiscountMultipliers,
                                [key]: '' as any
                              }
                            }));
                            return;
                          }
                          const value = parseFloat(val);
                          if (isNaN(value)) return;
                          
                          if (key === 'months1' && value !== 1.0) {
                            setErrorMsg('1-month multiplier must be 1.0 (base)');
                            return;
                          }
                          if (value < 0 || value > 1) {
                            setErrorMsg('Duration multiplier must be between 0 and 1');
                            return;
                          }
                          setErrorMsg('');
                          setMultipliersFormData(prev => ({
                            ...prev,
                            durationDiscountMultipliers: {
                              ...prev.durationDiscountMultipliers,
                              [key]: value
                            }
                          }));
                        }}
                        disabled={key === 'months1'}
                        className={`peer w-full px-0 pt-5 pb-2 text-sm sm:text-base text-gray-900 border-b bg-transparent focus:outline-none focus:border-[#3674B5] focus:ring-0 placeholder-transparent transition border-gray-300 ${key === 'months1' ? 'opacity-50 cursor-not-allowed' : ''}`}
                        required
                      />
                      <label
                        htmlFor={`duration_${months}`}
                        className="absolute left-0 text-gray-700 bg-transparent transition-all duration-200 -top-2 text-xs sm:text-sm text-gray-700 font-semibold"
                      >
                        {months} Month{months !== '1' ? 's' : ''} Discount Multiplier {key === 'months1' && '(Base - Fixed at 1.0)'}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex flex-col sm:flex-row justify-between gap-3 sm:gap-0 mt-6 sm:mt-8 space-y-0 sm:space-x-3">
            <button
              type="button"
              onClick={handleModalClose}
              className="px-4 py-2 text-sm sm:text-base text-gray-700 rounded-lg border hover:bg-gray-50 hover:text-gray-900 transition-colors order-2 sm:order-1"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createLoading || updateLoading}
              className="px-4 py-2 text-sm sm:text-base bg-[#3674B5] hover:bg-[#1B5087] text-white rounded-md disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors order-1 sm:order-2"
            >
              {createLoading || updateLoading ? 'Saving...' : editingConfig ? (
                <span className="hidden sm:inline">Update Configuration & Multipliers</span>
              ) : (
                <span className="hidden sm:inline">Create Configuration & Save Multipliers</span>
              )}
              {createLoading || updateLoading ? 'Saving...' : editingConfig ? (
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
        title="Delete Pricing Configuration"
        message={configToDelete ? `Are you sure you want to delete the pricing configuration for ${configToDelete.materialType} ${configToDelete.vehicleType} ${configToDelete.category}? This will archive it for 30 days before permanent deletion.` : ''}
        confirmText="Delete"
        cancelText="Cancel"
        confirmButtonClass="bg-red-600 hover:bg-red-700"
      />

      {/* Restore Confirmation Modal */}
      <ConfirmationModal
        isOpen={showRestoreModal}
        onClose={cancelRestore}
        onConfirm={confirmRestore}
        title="Restore Pricing Configuration"
        message={configToRestore ? `Are you sure you want to restore the pricing configuration for ${configToRestore.materialType} ${configToRestore.vehicleType} ${configToRestore.category}?` : ''}
        confirmText="Restore"
        cancelText="Cancel"
        confirmButtonClass="bg-green-600 hover:bg-green-700"
      />

      {/* Floating Action Button - Mobile Only */}
      <button
        onClick={handleCreateConfig}
        className="sm:hidden fixed bottom-6 right-6 z-50 w-14 h-14 bg-[#3674B5] hover:bg-[#3674B5]/90 text-white rounded-full shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95"
        aria-label="Create Pricing Config"
      >
        <Plus className="w-6 h-6" />
      </button>

    </div>
  );
};

export default SadminPricing;
