import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Plan, getMaterialTypeOptions, getMaxDevices, calculatePlanPricing } from './utils';

interface PlanFormData {
  planName: string;
  planDescription: string;
  durationDays: number;
  category: string;
  materialType: string;
  vehicleType: string;
  numberOfDevices: number;
  adLengthSeconds: number;
  playsPerDayPerDevice: number;
  pricePerPlayOverride: string | number;
  deviceCostOverride: string | number;
  durationCostOverride: string | number;
  adLengthCostOverride: string | number;
}

interface CreateEditPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formData: PlanFormData) => void;
  editingPlan: Plan | null;
  errorMsg: string;
  isLoading: boolean;
}

const CreateEditPlanModal: React.FC<CreateEditPlanModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  editingPlan,
  errorMsg,
  isLoading,
}) => {
  const [formData, setFormData] = useState<PlanFormData>({
    planName: '',
    planDescription: '',
    durationDays: 30,
    category: '',
    materialType: '',
    vehicleType: '',
    numberOfDevices: 1,
    adLengthSeconds: 20,
    playsPerDayPerDevice: 160,
    pricePerPlayOverride: '',
    deviceCostOverride: '',
    durationCostOverride: '',
    adLengthCostOverride: '',
  });

  const [calculatedPricing, setCalculatedPricing] = useState({
    totalPlaysPerDay: 0,
    dailyRevenue: 0,
    totalPrice: 0,
  });

  // Initialize form data when editing
  useEffect(() => {
    if (editingPlan) {
      setFormData({
        planName: editingPlan.name,
        planDescription: editingPlan.description,
        durationDays: editingPlan.durationDays,
        category: editingPlan.category,
        materialType: editingPlan.materialType,
        vehicleType: editingPlan.vehicleType,
        numberOfDevices: editingPlan.numberOfDevices,
        adLengthSeconds: editingPlan.adLengthSeconds,
        playsPerDayPerDevice: editingPlan.playsPerDayPerDevice,
        pricePerPlayOverride: '',
        deviceCostOverride: '',
        durationCostOverride: '',
        adLengthCostOverride: '',
      });
    } else {
      setFormData({
        planName: '',
        planDescription: '',
        durationDays: 30,
        category: '',
        materialType: '',
        vehicleType: '',
        numberOfDevices: 1,
        adLengthSeconds: 20,
        playsPerDayPerDevice: 160,
        pricePerPlayOverride: '',
        deviceCostOverride: '',
        durationCostOverride: '',
        adLengthCostOverride: '',
      });
    }
  }, [editingPlan]);

  // Auto-determine category based on material type
  useEffect(() => {
    if (formData.materialType === 'LCD') {
      setFormData((prev: PlanFormData) => ({ ...prev, category: 'DIGITAL' }));
    } else if (formData.materialType === 'HEADDRESS') {
      setFormData((prev: PlanFormData) => ({ ...prev, category: 'DIGITAL' }));
    }
  }, [formData.materialType]);

  // Calculate pricing when form data changes
  useEffect(() => {
    const pricing = calculatePlanPricing(
      formData.numberOfDevices,
      formData.playsPerDayPerDevice,
      formData.adLengthSeconds,
      formData.durationDays,
      typeof formData.pricePerPlayOverride === 'number' ? formData.pricePerPlayOverride : undefined,
      typeof formData.deviceCostOverride === 'number' ? formData.deviceCostOverride : undefined,
      typeof formData.durationCostOverride === 'number' ? formData.durationCostOverride : undefined,
      typeof formData.adLengthCostOverride === 'number' ? formData.adLengthCostOverride : undefined
    );
    setCalculatedPricing(pricing);
  }, [formData]);

  const handleInputChange = (field: keyof PlanFormData, value: string | number) => {
    setFormData((prev: PlanFormData) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const materialOptions = getMaterialTypeOptions(formData.category);
  const maxDevices = getMaxDevices(formData.vehicleType, formData.materialType);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="p-6 border-b">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900">
              {editingPlan ? 'Edit Plan' : 'Create New Plan'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {/* Error Message */}
          {errorMsg && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Plan Name */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Plan Name *
              </label>
              <input
                type="text"
                value={formData.planName}
                onChange={(e) => handleInputChange('planName', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter plan name"
                required
              />
            </div>

            {/* Plan Description */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Plan Description *
              </label>
              <textarea
                value={formData.planDescription}
                onChange={(e) => handleInputChange('planDescription', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter plan description"
                rows={3}
                required
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category *
              </label>
              <select
                value={formData.category}
                onChange={(e) => handleInputChange('category', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">Select category</option>
                <option value="DIGITAL">Digital</option>
                <option value="NON-DIGITAL">Non-Digital</option>
              </select>
            </div>

            {/* Material Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Material Type *
              </label>
              <select
                value={formData.materialType}
                onChange={(e) => handleInputChange('materialType', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
                disabled={!formData.category}
              >
                <option value="">Select material type</option>
                {materialOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Vehicle Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Vehicle Type *
              </label>
              <select
                value={formData.vehicleType}
                onChange={(e) => handleInputChange('vehicleType', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">Select vehicle type</option>
                <option value="CAR">Car</option>
                <option value="MOTORCYCLE">Motorcycle</option>
              </select>
            </div>

            {/* Number of Devices */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Number of Devices *
              </label>
              <input
                type="number"
                min="1"
                max={maxDevices}
                value={formData.numberOfDevices}
                onChange={(e) => handleInputChange('numberOfDevices', parseInt(e.target.value))}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Maximum: {maxDevices} devices for {formData.vehicleType} with {formData.materialType}
              </p>
            </div>

            {/* Duration Days */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Duration (Days) *
              </label>
              <input
                type="number"
                min="1"
                value={formData.durationDays}
                onChange={(e) => handleInputChange('durationDays', parseInt(e.target.value))}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            {/* Ad Length Seconds */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ad Length (Seconds) *
              </label>
              <input
                type="number"
                min="1"
                value={formData.adLengthSeconds}
                onChange={(e) => handleInputChange('adLengthSeconds', parseInt(e.target.value))}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            {/* Plays Per Day Per Device */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Plays Per Day Per Device *
              </label>
              <input
                type="number"
                min="1"
                value={formData.playsPerDayPerDevice}
                onChange={(e) => handleInputChange('playsPerDayPerDevice', parseInt(e.target.value))}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
          </div>

          {/* Pricing Overrides */}
          <div className="mt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Pricing Overrides (Optional)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Price Per Play Override
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.pricePerPlayOverride}
                  onChange={(e) => handleInputChange('pricePerPlayOverride', e.target.value ? parseFloat(e.target.value) : '')}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Default: 0.50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Device Cost Override
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.deviceCostOverride}
                  onChange={(e) => handleInputChange('deviceCostOverride', e.target.value ? parseFloat(e.target.value) : '')}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Default: 100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Duration Cost Override
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.durationCostOverride}
                  onChange={(e) => handleInputChange('durationCostOverride', e.target.value ? parseFloat(e.target.value) : '')}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Default: 10"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ad Length Cost Override
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.adLengthCostOverride}
                  onChange={(e) => handleInputChange('adLengthCostOverride', e.target.value ? parseFloat(e.target.value) : '')}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Default: 0.10"
                />
              </div>
            </div>
          </div>

          {/* Calculated Pricing */}
          <div className="mt-6 p-4 bg-gray-50 rounded-xl">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Calculated Pricing</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-600">Total Plays Per Day</p>
                <p className="text-xl font-semibold text-gray-900">{calculatedPricing.totalPlaysPerDay}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Daily Revenue</p>
                <p className="text-xl font-semibold text-green-600">₱{calculatedPricing.dailyRevenue.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Price</p>
                <p className="text-xl font-semibold text-blue-600">₱{calculatedPricing.totalPrice.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-4 mt-8">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-3 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Saving...' : editingPlan ? 'Update Plan' : 'Create Plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateEditPlanModal;
