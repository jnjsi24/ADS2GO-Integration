import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { Plus, Edit, X, Trash2, ChevronDown, ToggleLeft, ToggleRight, DollarSign, Settings } from 'lucide-react';
import { 
  GET_ALL_PRICING_CONFIGS, 
  PricingConfig, 
  PricingTier 
} from '../../graphql/superadmin/queries/pricingConfigQueries';
import { 
  CREATE_PRICING_CONFIG, 
  UPDATE_PRICING_CONFIG, 
  DELETE_PRICING_CONFIG, 
  TOGGLE_PRICING_CONFIG_STATUS,
  PricingConfigInput,
  PricingConfigUpdateInput
} from '../../graphql/superadmin/mutations/pricingConfigMutations';
import { motion, AnimatePresence } from "framer-motion";


const SadminPricing: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<PricingConfig | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [activeTab, setActiveTab] = useState<'active' | 'inactive'>('active');
  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});
  const [showVehicleDropdown, setShowVehicleDropdown] = useState(false);
  const [showMaterialDropdown, setShowMaterialDropdown] = useState(false);
  const [showDurationDropdowns, setShowDurationDropdowns] = useState<boolean[]>([]); // One for each tier

  // Form states
  const [formData, setFormData] = useState<PricingConfigInput>({
    materialType: '',
    vehicleType: '',
    category: '',
    pricingTiers: [{ durationDays: 30, pricePerPlay: 1.0 }],
    maxDevices: 1,
    minAdLengthSeconds: 20,
    maxAdLengthSeconds: 60,
    isActive: true
  });

  // GraphQL Hooks
  const { data, loading, error, refetch } = useQuery(GET_ALL_PRICING_CONFIGS, {
    errorPolicy: 'all',
    fetchPolicy: 'cache-and-network'
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
    },
    onError: (error) => {
      setErrorMsg(error.message || 'Failed to delete pricing configuration');
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

  // Filter configs by active status
  const filteredConfigs = configs.filter(config => 
    activeTab === 'active' ? config.isActive : !config.isActive
  );

  // Reset form function
  const resetForm = () => {
    setFormData({
      materialType: '',
      vehicleType: '',
      category: '',
      pricingTiers: [{ durationDays: 30, pricePerPlay: 1.0 }],
      maxDevices: 1,
      minAdLengthSeconds: 20,
      maxAdLengthSeconds: 60,
      isActive: true
    });
    setShowVehicleDropdown(false);
    setShowMaterialDropdown(false);
    setShowDurationDropdowns([false]);
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
        pricingTiers: editingConfig.pricingTiers,
        maxDevices: editingConfig.maxDevices,
        minAdLengthSeconds: editingConfig.minAdLengthSeconds,
        maxAdLengthSeconds: editingConfig.maxAdLengthSeconds,
        isActive: editingConfig.isActive
      });
      setShowDurationDropdowns(editingConfig.pricingTiers.map(() => false));
    }
  }, [editingConfig]);

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
    if (window.confirm(`Are you sure you want to delete the pricing configuration for ${config.materialType} ${config.vehicleType} ${config.category}?`)) {
      deletePricingConfig({ variables: { id: config.id } });
    }
  };

  const handleToggleStatus = (config: PricingConfig) => {
    togglePricingConfigStatus({ variables: { id: config.id } });
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
    if (!formData.materialType) errors.materialType = 'Material Type is required';
    if (!formData.category) errors.category = 'Category is required';
    if (formData.maxDevices < 1) errors.maxDevices = 'Max Devices must be at least 1';
    formData.pricingTiers.forEach((tier, index) => {
      if (tier.durationDays < 30) errors[`durationDays_${index}`] = 'Duration must be at least 30 days';
      if (tier.pricePerPlay <= 0) errors[`pricePerPlay_${index}`] = 'Price per Play must be positive';
      if (tier.adLengthMultiplier && (tier.adLengthMultiplier < 0.1 || tier.adLengthMultiplier > 2.0)) errors[`adLengthMultiplier_${index}`] = 'Multiplier must be between 0.1 and 2.0';
    });
  
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
  
    setValidationErrors({});
  
    if (editingConfig) {
      const updateInput: PricingConfigUpdateInput = {
        pricingTiers: formData.pricingTiers,
        maxDevices: formData.maxDevices,
        minAdLengthSeconds: formData.minAdLengthSeconds,
        maxAdLengthSeconds: formData.maxAdLengthSeconds,
        isActive: formData.isActive
      };
      updatePricingConfig({ variables: { id: editingConfig.id, input: updateInput } });
    } else {
      createPricingConfig({ variables: { input: formData } });
    }
  };

  const addPricingTier = () => {
    setFormData(prev => ({
      ...prev,
      pricingTiers: [...prev.pricingTiers, { durationDays: 30, pricePerPlay: 1.0 }]
    }));
    setShowDurationDropdowns(prev => [...prev, false]);
  };

  const removePricingTier = (index: number) => {
    if (formData.pricingTiers.length > 1) {
      setFormData(prev => ({
        ...prev,
        pricingTiers: prev.pricingTiers.filter((_, i) => i !== index)
      }));
      setShowDurationDropdowns(prev => prev.filter((_, i) => i !== index));
    }
  };

  const updatePricingTier = (index: number, field: keyof PricingTier, value: number) => {
    setFormData(prev => ({
      ...prev,
      pricingTiers: prev.pricingTiers.map((tier, i) => 
        i === index ? { ...tier, [field]: value } : tier
      )
    }));
  };

  const getMaxDevices = (vehicleType: string, materialType: string): number => {
    if (vehicleType === 'CAR') {
      if (materialType === 'LCD') return 3;
      if (materialType === 'HEADDRESS') return 2;
    }
    if (vehicleType === 'MOTORCYCLE') {
      if (materialType === 'LCD') return 1;
    }
    return 1;
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="min-h-screen ml-64 bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading pricing configurations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen ml-64 bg-gray-50">
      {/* Header */}
      <div>
        <div className="px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Pricing Management</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm border">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Configurations</p>
                <p className="text-2xl font-bold text-gray-900">{configs.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Settings className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Configurations</p>
                <p className="text-2xl font-bold text-gray-900">{configs.filter(c => c.isActive).length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border">
            <div className="flex items-center">
              <div className="p-3 bg-gray-100 rounded-lg">
                <ToggleLeft className="w-6 h-6 text-gray-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Inactive Configurations</p>
                <p className="text-2xl font-bold text-gray-900">{configs.filter(c => !c.isActive).length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center justify-between p-1 rounded-lg w-full mb-6">
          {/* Tabs on the left */}
          <div className="flex space-x-1 bg-gray-100 rounded-lg">
            <button
              onClick={() => setActiveTab('active')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'active'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Active ({configs.filter(c => c.isActive).length})
            </button>
            <button
              onClick={() => setActiveTab('inactive')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'inactive'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Inactive ({configs.filter(c => !c.isActive).length})
            </button>
          </div>

          {/* Create button on the right */}
          <button
            onClick={handleCreateConfig}
            className="bg-[#3674B5] hover:bg-[#1B5087] text-sm text-white px-6 py-3 rounded-xl transition-all duration-200 flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Create Pricing Config
          </button>
        </div>


        {/* Error Message */}
        {errorMsg && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            {errorMsg}
          </div>
        )}

        {/* Configurations List */}
        {filteredConfigs.length === 0 ? (
          <div className="text-center py-12">
            <div className="bg-gray-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <DollarSign className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No {activeTab} pricing configurations found
            </h3>
            <p className="text-gray-600 mb-6">
              {activeTab === 'active' 
                ? "Create a new pricing configuration to get started"
                : "No inactive configurations at the moment"
              }
            </p>
            {activeTab === 'active' && (
              <button
                onClick={handleCreateConfig}
                className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-all duration-200 flex items-center gap-2 mx-auto"
              >
                <Plus className="w-5 h-5" />
                Create Pricing Config
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredConfigs.map((config) => (
              <div key={config.id} className="bg-white rounded-xl p-6 shadow-sm border hover:shadow-md transition-shadow">
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {config.materialType} {config.vehicleType}
                      </h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
                        config.isActive 
                          ? 'bg-green-100 text-green-800 border-green-200'
                          : 'bg-gray-100 text-gray-800 border-gray-200'
                      }`}>
                        {config.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-gray-600 text-sm">{config.category}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleStatus(config)}
                      className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                      title={config.isActive ? 'Deactivate' : 'Activate'}
                    >
                      {config.isActive ? (
                        <ToggleRight className="w-4 h-4 text-green-600" />
                      ) : (
                        <ToggleLeft className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                    <button
                      onClick={() => handleEditConfig(config)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
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
                  </div>
                </div>

                {/* Configuration Details */}
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Max Devices:</span>
                    <span className="font-medium">{config.maxDevices}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Ad Length Range:</span>
                    <span className="font-medium">{config.minAdLengthSeconds}s - {config.maxAdLengthSeconds}s</span>
                  </div>
                  
                  {/* Pricing Tiers */}
                  <div className="border-t pt-3">
                    <p className="text-sm font-medium text-gray-700 mb-2">Pricing Tiers:</p>
                    <div className="space-y-2">
                      {config.pricingTiers.map((tier, index) => (
                        <div key={index} className="flex justify-between items-center text-sm">
                          <span className="text-gray-600">
                            {tier.durationDays === 30 ? '1 month' :
                             tier.durationDays === 60 ? '2 months' :
                             tier.durationDays === 90 ? '3 months' :
                             tier.durationDays === 120 ? '4 months' :
                             tier.durationDays === 150 ? '5 months' :
                             tier.durationDays === 180 ? '6 months' :
                             `${tier.durationDays} days`}:
                          </span>
                          <span className="font-medium text-green-600">
                            {formatCurrency(tier.pricePerPlay)}/play
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {isModalOpen && (
      <div className="fixed inset-0 bg-gray-500 bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl mx-4 p-8 max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900">
              {editingConfig ? 'Edit Pricing Configuration' : 'Create Pricing Configuration'}
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <div className="w-full px-4 py-3 text-sm border-b text-gray-600">
                  {formData.category || 'Will be determined automatically'}
                </div>
                {validationErrors.category && (
                  <p className="text-red-500 text-xs mt-1">{validationErrors.category}</p>
                )}
              </div>

              {/* Max Devices Floating Input */}
              <div className="relative">
                <input
                  type="number"
                  id="maxDevices"
                  placeholder=" "
                  min="1"
                  max={formData.vehicleType && formData.materialType ? getMaxDevices(formData.vehicleType, formData.materialType) : 10}
                  value={formData.maxDevices}
                  onChange={(e) => setFormData(prev => ({ ...prev, maxDevices: parseInt(e.target.value) }))}
                  className={`peer w-full px-0 pt-5 pb-2 text-gray-900 border-b bg-transparent focus:outline-none focus:border-blue-500 focus:ring-0 placeholder-transparent transition ${validationErrors.maxDevices ? 'border-red-400' : 'border-gray-300'}`}
                  required
                />
                <label
                  htmlFor="maxDevices"
                  className={`absolute left-0 text-gray-700/80 bg-transparent transition-all duration-200 ${formData.maxDevices ? '-top-2 text-sm text-gray-700/70 font-semibold' : 'peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-700/80'} peer-focus:-top-2 peer-focus:text-sm peer-focus:text-gray-700/70 peer-focus:font-semibold`}
                >
                  Max Devices
                </label>
                {validationErrors.maxDevices && (
                  <p className="text-red-500 text-xs mt-1">{validationErrors.maxDevices}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Maximum: {formData.vehicleType && formData.materialType ? getMaxDevices(formData.vehicleType, formData.materialType) : 10} devices
                </p>
              </div>
            </div>

            {/* Pricing Tiers */}
            <div className="mt-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">Pricing Tiers</h3>
                <button
                  type="button"
                  onClick={addPricingTier}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  + Add Tier
                </button>
              </div>

              <div className="space-y-4">
                {formData.pricingTiers.map((tier, index) => (
                  <div key={index} className="flex gap-4 items-end">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Duration (days)
                      </label>
                      <div className="relative w-full">
                        <button
                          type="button"
                          onClick={() => {
                            const newDropdowns = [...showDurationDropdowns];
                            newDropdowns[index] = !newDropdowns[index];
                            setShowDurationDropdowns(newDropdowns);
                          }}
                          className="flex items-center justify-between w-full text-xs text-black rounded-lg pl-6 pr-4 py-3 shadow-md focus:outline-none bg-white gap-2"                        >
                          {tier.durationDays ? `${tier.durationDays / 30} month${tier.durationDays > 30 ? 's' : ''} (${tier.durationDays} days)` : 'Select duration'}
                          <ChevronDown
                            size={16}
                            className={`transform transition-transform duration-200 ${showDurationDropdowns[index] ? "rotate-180" : "rotate-0"}`}
                          />
                        </button>
                        <AnimatePresence>
                          {showDurationDropdowns[index] && (
                            <motion.div
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              transition={{ duration: 0.2 }}
                              className="absolute z-10 top-full mt-2 w-full rounded-xl shadow-lg bg-white overflow-hidden"
                            >
                              {[30, 60, 90, 120, 150, 180].map((days) => (
                                <button
                                  key={days}
                                  type="button"
                                  onClick={() => {
                                    updatePricingTier(index, 'durationDays', days);
                                    const newDropdowns = [...showDurationDropdowns];
                                    newDropdowns[index] = false;
                                    setShowDurationDropdowns(newDropdowns);
                                  }}
                                  className="block w-full text-left px-4 py-2 text-xs ml-2 text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                                >
                                  {days / 30} month{days > 30 ? 's' : ''} ({days} days)
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                      {validationErrors[`durationDays_${index}`] && (
                        <p className="text-red-500 text-xs mt-1">{validationErrors[`durationDays_${index}`]}</p>
                      )}
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="number"
                        id={`pricePerPlay_${index}`}
                        placeholder=" "
                        step="0.01"
                        min="0.01"
                        value={tier.pricePerPlay}
                        onChange={(e) => updatePricingTier(index, 'pricePerPlay', parseFloat(e.target.value))}
                        className={`peer w-full px-0 pt-5 pb-2 text-gray-900 border-b bg-transparent focus:outline-none focus:border-blue-500 focus:ring-0 placeholder-transparent transition ${validationErrors[`pricePerPlay_${index}`] ? 'border-red-400' : 'border-gray-300'}`}
                        required
                      />
                      <label
                        htmlFor={`pricePerPlay_${index}`}
                        className={`absolute left-0 text-gray-700/80 bg-transparent transition-all duration-200 ${tier.pricePerPlay ? '-top-2 text-sm text-gray-700/70 font-semibold' : 'peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-700/80'} peer-focus:-top-2 peer-focus:text-sm peer-focus:text-gray-700/70 peer-focus:font-semibold`}
                      >
                        Price per Play (₱)
                      </label>
                      {validationErrors[`pricePerPlay_${index}`] && (
                        <p className="text-red-500 text-xs mt-1">{validationErrors[`pricePerPlay_${index}`]}</p>
                      )}
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="number"
                        id={`adLengthMultiplier_${index}`}
                        placeholder=" "
                        step="0.1"
                        min="0.1"
                        max="2.0"
                        value={tier.adLengthMultiplier || 1.0}
                        onChange={(e) => updatePricingTier(index, 'adLengthMultiplier', parseFloat(e.target.value))}
                        className={`peer w-full px-0 pt-5 pb-2 text-gray-900 border-b bg-transparent focus:outline-none focus:border-blue-500 focus:ring-0 placeholder-transparent transition ${validationErrors[`adLengthMultiplier_${index}`] ? 'border-red-400' : 'border-gray-300'}`}
                      />
                      <label
                        htmlFor={`adLengthMultiplier_${index}`}
                        className={`absolute left-0 text-gray-700/80 bg-transparent transition-all duration-200 ${tier.adLengthMultiplier ? '-top-2 text-sm text-gray-700/70 font-semibold' : 'peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-700/80'} peer-focus:-top-2 peer-focus:text-sm peer-focus:text-gray-700/70 peer-focus:font-semibold`}
                      >
                        Ad Length Multiplier
                      </label>
                      {validationErrors[`adLengthMultiplier_${index}`] && (
                        <p className="text-red-500 text-xs mt-1">{validationErrors[`adLengthMultiplier_${index}`]}</p>
                      )}
                    </div>
                    {formData.pricingTiers.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removePricingTier(index)}
                        className="p-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Ad Length Range */}
              <div className="md:col-span-2">
                <label className="block text-sm mt-6 font-medium text-gray-700 mb-2">
                  Ad Length Range
                </label>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-sm text-gray-600 mb-2">Allowed ad lengths:</p>
                  <div className="flex gap-4">
                    <div className="flex items-center">
                      <input
                        type="radio"
                        id="adLength20"
                        name="adLength"
                        value="20"
                        checked={formData.minAdLengthSeconds === 20 && formData.maxAdLengthSeconds === 60}
                        onChange={() => setFormData(prev => ({ ...prev, minAdLengthSeconds: 20, maxAdLengthSeconds: 60 }))}
                        className="mr-2"
                      />
                      <label htmlFor="adLength20" className="text-sm">20, 40, or 60 seconds</label>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Only these three ad lengths are allowed in the system
                  </p>
                </div>
              </div>
            </div>

            {/* Form Actions */}
            {/* <div className="flex justify-end gap-4 mt-8"> */}
              

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
              {createLoading || updateLoading ? 'Saving...' : editingConfig ? 'Update Configuration' : 'Create Configuration'}
            </button>
          </div>
          </form>
        </div>
      </div>
    )}
    </div>
  );
};

export default SadminPricing;
