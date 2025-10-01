import React, { useState, useEffect } from "react";
import { X, ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Plan,
  getMaterialTypeOptions,
  getMaxDevices,
  calculatePlanPricing,
} from "./utils";

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
  startType: "immediate" | "scheduled";
  scheduledStartDate: string;
  scheduledEndDate: string;
}

interface CreateEditPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formData: PlanFormData) => void;
  editingPlan: Plan | null;
  errorMsg?: string;
  isLoading?: boolean;
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
    planName: "",
    planDescription: "",
    durationDays: 30,
    category: "",
    materialType: "",
    vehicleType: "",
    numberOfDevices: 1,
    adLengthSeconds: 20,
    playsPerDayPerDevice: 160,
    pricePerPlayOverride: "",
    startType: "immediate",
    scheduledStartDate: "",
    scheduledEndDate: "",
  });

  const [calculatedPricing, setCalculatedPricing] = useState({
    totalPlaysPerDay: 0,
    dailyRevenue: 0,
    totalPrice: 0,
  });

  // Dropdown states
  const [showCategory, setShowCategory] = useState(false);
  const [showMaterial, setShowMaterial] = useState(false);
  const [showVehicle, setShowVehicle] = useState(false);

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
        pricePerPlayOverride: "",
        startType: "immediate",
        scheduledStartDate: "",
        scheduledEndDate: "",
      });
    }
  }, [editingPlan]);

  // Auto-set category based on material type
  useEffect(() => {
    if (formData.materialType === "LCD" || formData.materialType === "HEADDRESS") {
      setFormData((prev) => ({ ...prev, category: "DIGITAL" }));
    }
  }, [formData.materialType]);

  // Recalculate pricing on form changes
  useEffect(() => {
    const pricing = calculatePlanPricing(
      formData.numberOfDevices,
      formData.playsPerDayPerDevice,
      formData.adLengthSeconds,
      formData.durationDays,
      typeof formData.pricePerPlayOverride === "number"
        ? formData.pricePerPlayOverride
        : undefined
    );
    setCalculatedPricing(pricing);
  }, [formData]);

  const handleInputChange = (field: keyof PlanFormData, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const materialOptions = getMaterialTypeOptions(formData.category);
  const maxDevices = getMaxDevices(formData.vehicleType, formData.materialType);

  if (!isOpen) return null;


  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
    onClick={handleBackdropClick} // ✅ New: detect backdrop clicks
    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
  >
    <div className="bg-white rounded-md w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="p-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900">
              {editingPlan ? "Edit Plan" : "Create New Plan"}
            </h2>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-8">
          {/* Error message */}
          {errorMsg && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-md flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full" />
              {errorMsg}
            </div>
          )}

          {/* === Basic Details === */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Plan Name */}
            <div className="relative md:col-span-2">
              <input
                id="planName"
                type="text"
                required
                value={formData.planName}
                placeholder="Plan Name"
                onChange={(e) => handleInputChange("planName", e.target.value)}
                className="peer w-full px-0 pt-5 pb-2 text-gray-900 border-b border-gray-300
                           focus:outline-none focus:border-blue-500 placeholder-transparent transition"
              />
              <label
                htmlFor="planName"
                className="absolute left-0 -top-2 text-sm text-gray-500 transition-all
                  peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400
                  peer-focus:-top-2 peer-focus:text-sm peer-focus:text-blue-600 peer-focus:font-semibold"
              >
                Plan Name
              </label>
            </div>

            {/* Description */}
            <div className="relative md:col-span-2">
              <textarea
                id="planDescription"
                required
                value={formData.planDescription}
                placeholder="Plan Description"
                onChange={(e) =>
                  handleInputChange("planDescription", e.target.value)
                }
                rows={3}
                className="peer w-full px-0 pt-5 pb-2 text-gray-900 border-b border-gray-300
                           focus:outline-none focus:border-blue-500 placeholder-transparent transition"
              />
              <label
                htmlFor="planDescription"
                className="absolute left-0 -top-2 text-sm text-gray-500 transition-all
                  peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400
                  peer-focus:-top-2 peer-focus:text-sm peer-focus:text-blue-600 peer-focus:font-semibold"
              >
                Plan Description
              </label>
            </div>

            {/* Category Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowCategory(!showCategory)}
                className="flex items-center justify-between w-full text-sm text-gray-900
                           rounded-md pl-4 pr-3 py-3 shadow-md bg-white focus:outline-none gap-2"
              >
                {formData.category || "Select category"}
                <ChevronDown
                  size={16}
                  className={`transition-transform ${showCategory ? "rotate-180" : ""}`}
                />
              </button>
              <AnimatePresence>
                {showCategory && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="absolute z-10 mt-2 w-full rounded-md shadow-lg bg-white overflow-hidden"
                  >
                    {["DIGITAL", "NON-DIGITAL"].map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          handleInputChange("category", cat);
                          setShowCategory(false);
                        }}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        {cat}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Material Dropdown */}
            <div className="relative">
              <button
                type="button"
                disabled={!formData.category}
                onClick={() => setShowMaterial(!showMaterial)}
                className={`flex items-center justify-between w-full text-sm rounded-md pl-4 pr-3 py-3 shadow-md focus:outline-none gap-2 ${
                  formData.category ? "bg-white text-gray-900" : "bg-gray-100 text-gray-400"
                }`}
              >
                {formData.materialType || "Select material type"}
                <ChevronDown
                  size={16}
                  className={`transition-transform ${showMaterial ? "rotate-180" : ""}`}
                />
              </button>
              <AnimatePresence>
                {showMaterial && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="absolute z-10 mt-2 w-full rounded-md shadow-lg bg-white overflow-hidden"
                  >
                    {materialOptions.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          handleInputChange("materialType", opt.value);
                          setShowMaterial(false);
                        }}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Vehicle Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowVehicle(!showVehicle)}
                className="flex items-center justify-between w-full text-sm text-gray-900 rounded-md pl-4 pr-3 py-3 shadow-md bg-white focus:outline-none gap-2"
              >
                {formData.vehicleType || "Select vehicle type"}
                <ChevronDown
                  size={16}
                  className={`transition-transform ${showVehicle ? "rotate-180" : ""}`}
                />
              </button>
              <AnimatePresence>
                {showVehicle && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="absolute z-10 mt-2 w-full rounded-md shadow-lg bg-white overflow-hidden"
                  >
                    {["CAR", "MOTORCYCLE"].map((veh) => (
                      <button
                        key={veh}
                        type="button"
                        onClick={() => {
                          handleInputChange("vehicleType", veh);
                          setShowVehicle(false);
                        }}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        {veh}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Number of Devices */}
            <div className="relative">
              <input
                type="number"
                min="1"
                max={maxDevices}
                value={formData.numberOfDevices}
                placeholder="Number of Devices"
                onChange={(e) =>
                  handleInputChange("numberOfDevices", parseInt(e.target.value))
                }
                className="peer w-full px-0 pt-5 pb-2 text-gray-900 border-b border-gray-300
                           focus:outline-none focus:border-blue-500 placeholder-transparent transition"
                required
              />
              <label
                className="absolute left-0 -top-2 text-sm text-gray-500 transition-all
                  peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400
                  peer-focus:-top-2 peer-focus:text-sm peer-focus:text-blue-600 peer-focus:font-semibold"
              >
                Number of Devices 
              </label>
              <p className="text-xs text-gray-500 mt-1">Maximum: {maxDevices} devices</p>
            </div>

            {/* Duration Days */}
            <div className="relative">
              <input
                type="number"
                min="1"
                value={formData.durationDays}
                placeholder="Duration Days"
                onChange={(e) =>
                  handleInputChange("durationDays", parseInt(e.target.value))
                }
                className="peer w-full px-0 pt-5 pb-2 text-gray-900 border-b border-gray-300
                           focus:outline-none focus:border-blue-500 placeholder-transparent transition"
                required
              />
              <label
                className="absolute left-0 -top-2 text-sm text-gray-500 transition-all
                  peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400
                  peer-focus:-top-2 peer-focus:text-sm peer-focus:text-blue-600 peer-focus:font-semibold"
              >
                Duration (Days) 
              </label>
            </div>

            {/* Ad Length */}
            <div className="relative">
              <input
                type="number"
                min="1"
                value={formData.adLengthSeconds}
                placeholder="Ad Length Seconds"
                onChange={(e) =>
                  handleInputChange("adLengthSeconds", parseInt(e.target.value))
                }
                className="peer w-full px-0 pt-5 pb-2 text-gray-900 border-b border-gray-300
                           focus:outline-none focus:border-blue-500 placeholder-transparent transition"
                required
              />
              <label
                className="absolute left-0 -top-2 text-sm text-gray-500 transition-all
                  peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400
                  peer-focus:-top-2 peer-focus:text-sm peer-focus:text-blue-600 peer-focus:font-semibold"
              >
                Ad Length (Seconds) 
              </label>
            </div>
          </div>

          {/* Price & Plays Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Price Per Play with floating label */}
            

            {/* Plays Per Day Per Device */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Device Plays/Day (Auto Calculated)
              </label>
              <div className="w-full px-4 py-3 border border-gray-200 rounded-md bg-gray-50 text-gray-600">
                {formData.adLengthSeconds > 0
                  ? Math.floor((8 * 60 * 60) / formData.adLengthSeconds)
                  : "Enter ad length to calculate"}{" "}
                plays per day
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-100 rounded-md">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Date 
                    </label>
                    <input
                      type="date"
                      value={formData.scheduledStartDate}
                      onChange={(e) => handleInputChange('scheduledStartDate', e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required={formData.startType === 'scheduled'}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      End Date 
                    </label>
                    <input
                      type="date"
                      value={formData.scheduledEndDate}
                      onChange={(e) => handleInputChange('scheduledEndDate', e.target.value)}
                      min={formData.scheduledStartDate || new Date().toISOString().split('T')[0]}
                      className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
            <h3 className="text-lg font-medium text-gray-900 mb-4">Pricing <span className="text-sm text-blue-500">Required</span></h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative w-full">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={formData.pricePerPlayOverride}
                  placeholder="Price Per Play" // Needed for peer animation
                  onChange={(e) =>
                    handleInputChange(
                      "pricePerPlayOverride",
                      e.target.value ? parseFloat(e.target.value) : ""
                    )
                  }
                  className="peer w-full px-0 pt-5 pb-2 text-gray-900 border-b border-gray-300
                            focus:outline-none focus:border-blue-500 placeholder-transparent transition"
                  required
                />
                <label
                  className="absolute left-0 -top-2 text-sm text-gray-500 transition-all
                    peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400
                    peer-focus:-top-2 peer-focus:text-sm peer-focus:text-blue-600 peer-focus:font-semibold"
                >
                  Price Per Play
                </label>

                <p className="text-xs text-gray-500 mt-1">
                  This is the base price per ad play. Total price will be calculated based on this.
                </p>
              </div>
            </div>
          </div>


          {/* Calculated Pricing Display */}
          <div className="mt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Calculated Pricing</h3>
            <div className="bg-gray-50 rounded-md p-4 space-y-3">
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
          <div className="flex justify-between pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-1 rounded-lg hover:bg-gray-100 text-gray-700 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="bg-[#3674B5] text-white px-4 py-2 rounded-lg font-semibold hover:bg-[#1b5087] transition-colors shadow-md disabled:bg-gray-400 disabled:cursor-not-allowed"
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
