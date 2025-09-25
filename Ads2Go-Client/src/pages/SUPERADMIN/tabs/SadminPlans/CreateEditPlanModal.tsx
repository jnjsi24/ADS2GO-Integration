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
  // Scheduling options
  startType: 'immediate' | 'scheduled';
  scheduledStartDate: string;
  scheduledEndDate: string;
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
    // Scheduling options
    startType: 'immediate',
    scheduledStartDate: '',
    scheduledEndDate: '',
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
        // Scheduling options
        startType: 'immediate',
        scheduledStartDate: '',
        scheduledEndDate: '',
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
        // Scheduling options
        startType: 'immediate',
        scheduledStartDate: '',
        scheduledEndDate: '',
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
      typeof formData.pricePerPlayOverride === 'number' ? formData.pricePerPlayOverride : undefined
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

            {/* Plays Per Day Per Device - Auto Calculated */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Plays Per Day Per Device (Auto Calculated)
              </label>
              <div className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-600">
                {formData.adLengthSeconds > 0 ? 
                  Math.floor((8 * 60 * 60) / formData.adLengthSeconds) : 
                  'Enter ad length to calculate'
                } plays per day
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Calculated based on 8 hours screen time ÷ ad length
              </p>
            </div>
          </div>

          {/* Scheduling Options */}
          <div className="mt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Plan Scheduling</h3>
            <div className="space-y-4">
              {/* Start Type Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  When should this plan start?
                </label>
                <div className="space-y-3">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="startType"
                      value="immediate"
                      checked={formData.startType === 'immediate'}
                      onChange={(e) => handleInputChange('startType', e.target.value)}
                      className="mr-3 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <div className="font-medium text-gray-900">Start Immediately</div>
                      <div className="text-sm text-gray-500">Plan will be active right after creation</div>
                    </div>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="startType"
                      value="scheduled"
                      checked={formData.startType === 'scheduled'}
                      onChange={(e) => handleInputChange('startType', e.target.value)}
                      className="mr-3 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <div className="font-medium text-gray-900">Schedule for Later</div>
                      <div className="text-sm text-gray-500">Set specific start and end dates</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Scheduled Dates */}
              {formData.startType === 'scheduled' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-blue-50 rounded-xl border border-blue-200">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Date *
                    </label>
                    <input
                      type="date"
                      value={formData.scheduledStartDate}
                      onChange={(e) => handleInputChange('scheduledStartDate', e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required={formData.startType === 'scheduled'}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      End Date *
                    </label>
                    <input
                      type="date"
                      value={formData.scheduledEndDate}
                      onChange={(e) => handleInputChange('scheduledEndDate', e.target.value)}
                      min={formData.scheduledStartDate || new Date().toISOString().split('T')[0]}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required={formData.startType === 'scheduled'}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-xs text-blue-600">
                      💡 Scheduled plans will be PENDING until the start date, then automatically become RUNNING.
                      They will automatically become ENDED after the end date.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Required Pricing */}
          <div className="mt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Pricing (Required)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Price Per Play *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={formData.pricePerPlayOverride}
                  onChange={(e) => handleInputChange('pricePerPlayOverride', e.target.value ? parseFloat(e.target.value) : '')}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter price per play (e.g., 1.00)"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  This is the base price per ad play. Total price will be calculated based on this.
                </p>
              </div>
            </div>
          </div>

          {/* Calculated Pricing Display */}
          <div className="mt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Calculated Pricing</h3>
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Plays Per Day Per Device:</span>
                <span className="font-medium">
                  {formData.adLengthSeconds > 0 ? 
                    Math.floor((8 * 60 * 60) / formData.adLengthSeconds) : 
                    'Enter ad length to calculate'
                  } plays
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Total Plays Per Day:</span>
                <span className="font-medium">
                  {formData.adLengthSeconds > 0 && formData.numberOfDevices > 0 ? 
                    Math.floor((8 * 60 * 60) / formData.adLengthSeconds) * formData.numberOfDevices : 
                    'Enter details to calculate'
                  } plays
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Daily Revenue:</span>
                <span className="font-medium">
                  {formData.pricePerPlayOverride && formData.adLengthSeconds > 0 && formData.numberOfDevices > 0 ? 
                    `₱${(Math.floor((8 * 60 * 60) / formData.adLengthSeconds) * formData.numberOfDevices * formData.pricePerPlayOverride).toLocaleString()}` : 
                    'Enter details to calculate'
                  }
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Total Price:</span>
                <span className="font-medium text-lg text-blue-600">
                  {formData.pricePerPlayOverride && formData.adLengthSeconds > 0 && formData.numberOfDevices > 0 && formData.durationDays > 0 ? 
                    `₱${(Math.floor((8 * 60 * 60) / formData.adLengthSeconds) * formData.numberOfDevices * formData.pricePerPlayOverride * formData.durationDays).toLocaleString()}` : 
                    'Enter details to calculate'
                  }
                </span>
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
