import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { Plus, Edit, Trash2, ToggleLeft, ToggleRight, DollarSign, Settings } from 'lucide-react';
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

const SadminPricing: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<PricingConfig | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [activeTab, setActiveTab] = useState<'active' | 'inactive'>('active');

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
  };

  const removePricingTier = (index: number) => {
    if (formData.pricingTiers.length > 1) {
      setFormData(prev => ({
        ...prev,
        pricingTiers: prev.pricingTiers.filter((_, i) => i !== index)
      }));
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
      <div className="bg-white shadow-sm border-b">
        <div className="px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Pricing Management</h1>
              <p className="text-gray-600 mt-1">Configure pricing for different field combinations</p>
            </div>
            <button
              onClick={handleCreateConfig}
              className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-all duration-200 flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Create Pricing Config
            </button>
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
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit mb-6">
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6 border-b">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">
                  {editingConfig ? 'Edit Pricing Configuration' : 'Create Pricing Configuration'}
                </h2>
                <button
                  onClick={handleModalClose}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  ×
                </button>
              </div>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6">
              {/* Error Message */}
              {errorMsg && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  {errorMsg}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Material Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Material Type *
                  </label>
                  <select
                    value={formData.materialType}
                    onChange={(e) => setFormData(prev => ({ ...prev, materialType: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                    disabled={!!editingConfig}
                  >
                    <option value="">Select material type</option>
                    <option value="LCD">LCD</option>
                    <option value="HEADDRESS">Headdress</option>
                  </select>
                </div>

                {/* Vehicle Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Vehicle Type *
                  </label>
                  <select
                    value={formData.vehicleType}
                    onChange={(e) => setFormData(prev => ({ ...prev, vehicleType: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                    disabled={!!editingConfig}
                  >
                    <option value="">Select vehicle type</option>
                    <option value="CAR">Car</option>
                    <option value="MOTORCYCLE">Motorcycle</option>
                  </select>
                </div>

                {/* Category (Auto-determined) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category *
                  </label>
                  <div className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-600">
                    {formData.category || 'Will be determined automatically'}
                  </div>
                </div>

                {/* Max Devices */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Devices *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={formData.vehicleType && formData.materialType ? getMaxDevices(formData.vehicleType, formData.materialType) : 10}
                    value={formData.maxDevices}
                    onChange={(e) => setFormData(prev => ({ ...prev, maxDevices: parseInt(e.target.value) }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Maximum: {formData.vehicleType && formData.materialType ? getMaxDevices(formData.vehicleType, formData.materialType) : 10} devices
                  </p>
                </div>

                {/* Ad Length Range */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ad Length Range *
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
                        <select
                          value={tier.durationDays}
                          onChange={(e) => updatePricingTier(index, 'durationDays', parseInt(e.target.value))}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          required
                        >
                          <option value={30}>1 month (30 days)</option>
                          <option value={60}>2 months (60 days)</option>
                          <option value={90}>3 months (90 days)</option>
                          <option value={120}>4 months (120 days)</option>
                          <option value={150}>5 months (150 days)</option>
                          <option value={180}>6 months (180 days)</option>
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Price per Play (₱)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={tier.pricePerPlay}
                          onChange={(e) => updatePricingTier(index, 'pricePerPlay', parseFloat(e.target.value))}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          required
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Ad Length Multiplier
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="0.1"
                          max="2.0"
                          value={tier.adLengthMultiplier || 1.0}
                          onChange={(e) => updatePricingTier(index, 'adLengthMultiplier', parseFloat(e.target.value))}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
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
              </div>

              {/* Form Actions */}
              <div className="flex justify-end gap-4 mt-8">
                <button
                  type="button"
                  onClick={handleModalClose}
                  className="px-6 py-3 rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading || updateLoading}
                  className="px-6 py-3 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
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
