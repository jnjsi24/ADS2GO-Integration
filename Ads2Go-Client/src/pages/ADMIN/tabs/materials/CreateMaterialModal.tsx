import React, { useState, useEffect } from 'react';
import { X, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CreateMaterialInput {
  vehicleType: 'CAR' | 'MOTORCYCLE' | 'BUS' | 'JEEP' | 'E_TRIKE';
  materialType: 'POSTER' | 'LCD' | 'STICKER' | 'HEADDRESS' | 'BANNER';
  description: string;
  requirements: string;
  category: 'DIGITAL' | 'NON_DIGITAL';
}

interface CreateMaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formData: CreateMaterialInput) => void;
  creating: boolean;
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

const categoryOptions = [
  { value: 'DIGITAL', label: 'Digital' },
  { value: 'NON_DIGITAL', label: 'Non-Digital' }
];

const vehicleOptions = [
  { value: 'CAR', label: 'Car' },
  { value: 'MOTORCYCLE', label: 'Motorcycle' },
  { value: 'BUS', label: 'Bus' },
  { value: 'JEEP', label: 'Jeep' },
  { value: 'E_TRIKE', label: 'E-Trike' }
];

const CreateMaterialModal: React.FC<CreateMaterialModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  creating
}) => {
  const [createForm, setCreateForm] = useState<CreateMaterialInput>({
    vehicleType: 'CAR',
    materialType: 'LCD',
    description: '',
    requirements: '',
    category: 'DIGITAL'
  });
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showVehicleDropdown, setShowVehicleDropdown] = useState(false);
  const [showMaterialDropdown, setShowMaterialDropdown] = useState(false);

  // Get available material types based on vehicle and category
  const getAvailableMaterialTypes = (vehicleType: string, category: string) => {
    return VEHICLE_MATERIAL_MAP[category as keyof typeof VEHICLE_MATERIAL_MAP]?.[vehicleType as keyof typeof VEHICLE_MATERIAL_MAP.DIGITAL] || [];
  };

  // Create material options for dropdown
  const materialOptions = getAvailableMaterialTypes(createForm.vehicleType, createForm.category).map(type => ({
    value: type,
    label: type.charAt(0) + type.slice(1).toLowerCase()
  }));

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.requirements.trim()) {
      alert('Please fill out this field');
      return;
    }

    onSubmit({
      ...createForm,
      description: createForm.description.trim() || ""
    });
  };

  const handleClose = () => {
    setCreateForm({
      vehicleType: 'CAR',
      materialType: 'LCD',
      description: '',
      requirements: '',
      category: 'DIGITAL'
    });
    setShowCategoryDropdown(false);
    setShowVehicleDropdown(false);
    setShowMaterialDropdown(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-800">Create New Material</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <label className="block text-sm font-bold text-gray-700 mb-1">
              Category 
            </label>
            <button
              type="button"
              onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
              className="flex items-center justify-between w-full text-sm text-black rounded-lg pl-3 pr-4 py-3 shadow-md focus:outline-none bg-white gap-2"
            >
              {categoryOptions.find(opt => opt.value === createForm.category)?.label}
              <ChevronDown
                size={16}
                className={`transform transition-transform duration-200 ${
                  showCategoryDropdown ? 'rotate-180' : 'rotate-0'
                }`}
              />
            </button>
            <AnimatePresence>
              {showCategoryDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="absolute z-10 top-full mt-2 w-full rounded-lg shadow-lg bg-white overflow-hidden"
                >
                  {categoryOptions.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setCreateForm({...createForm, category: opt.value as 'DIGITAL' | 'NON_DIGITAL'});
                        setShowCategoryDropdown(false);
                      }}
                      className="block w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                    >
                      {opt.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="relative">
            <label className="block text-sm font-bold text-gray-700 mb-1">
              Vehicle Type 
            </label>
            <button
              type="button"
              onClick={() => setShowVehicleDropdown(!showVehicleDropdown)}
              className="flex items-center justify-between w-full text-sm text-black rounded-lg pl-3 pr-4 py-3 shadow-md focus:outline-none bg-white gap-2"
            >
              {vehicleOptions.find(opt => opt.value === createForm.vehicleType)?.label}
              <ChevronDown
                size={16}
                className={`transform transition-transform duration-200 ${
                  showVehicleDropdown ? 'rotate-180' : 'rotate-0'
                }`}
              />
            </button>
            <AnimatePresence>
              {showVehicleDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="absolute z-10 top-full mt-2 w-full rounded-lg shadow-lg bg-white overflow-hidden"
                >
                  {vehicleOptions.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setCreateForm({...createForm, vehicleType: opt.value as any});
                        setShowVehicleDropdown(false);
                      }}
                      className="block w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                    >
                      {opt.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="relative">
            <label className="block text-sm font-bold text-gray-700 mb-1">
              Material Type
            </label>
            <button
              type="button"
              onClick={() => setShowMaterialDropdown(!showMaterialDropdown)}
              className="flex items-center justify-between w-full text-sm text-black rounded-lg pl-3 pr-4 py-3 shadow-md focus:outline-none bg-white gap-2"
            >
              {materialOptions.find(opt => opt.value === createForm.materialType)?.label}
              <ChevronDown
                size={16}
                className={`transform transition-transform duration-200 ${
                  showMaterialDropdown ? 'rotate-180' : 'rotate-0'
                }`}
              />
            </button>
            <AnimatePresence>
              {showMaterialDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="absolute z-10 top-full mt-2 w-full rounded-lg shadow-lg bg-white overflow-hidden"
                >
                  {materialOptions.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setCreateForm({...createForm, materialType: opt.value as any});
                        setShowMaterialDropdown(false);
                      }}
                      className="block w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                    >
                      {opt.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={createForm.description}
              onChange={(e) => setCreateForm({...createForm, description: e.target.value})}
              className="w-full px-3 py-2 border border-gray-200 shadow-md rounded-lg focus:outline-none"
              placeholder="Enter description"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              Requirements
            </label>
            <textarea
              value={createForm.requirements}
              onChange={(e) => setCreateForm({...createForm, requirements: e.target.value})}
              className="w-full px-3 py-2 border border-gray-200 shadow-md rounded-lg focus:outline-none"
              placeholder="Enter material requirements"
              rows={3}
              required
            />
          </div>
          <div className="flex justify-between gap-3 pt-5">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 rounded-lg border hover:bg-gray-50 hover:text-gray-900 transition-colors"
            >
              Cancel
            </button>
            <button
              disabled={creating}
              className="px-4 py-2 bg-[#3674B5] text-white rounded-lg hover:bg-[#578FCA] transition-colors"
            >
              {creating ? 'Creating...' : 'Create Material'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateMaterialModal;