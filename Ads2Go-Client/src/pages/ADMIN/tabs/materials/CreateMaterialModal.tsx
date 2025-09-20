import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

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
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-800">Create New Material</h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              Category <span className="text-red-500">*</span>
            </label>
            <select
              value={createForm.category}
              onChange={(e) => setCreateForm({...createForm, category: e.target.value as 'DIGITAL' | 'NON_DIGITAL'})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline focus:outline-gray-300"
              required
            >
              <option value="DIGITAL">Digital</option>
              <option value="NON_DIGITAL">Non-Digital</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              Vehicle Type <span className="text-red-500">*</span>
            </label>
            <select
              value={createForm.vehicleType}
              onChange={(e) => setCreateForm({...createForm, vehicleType: e.target.value as any})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline focus:outline-gray-300"
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
            <label className="block text-sm font-bold text-gray-700 mb-1">
              Material Type <span className="text-red-500">*</span>
            </label>
            <select
              value={createForm.materialType}
              onChange={(e) => setCreateForm({...createForm, materialType: e.target.value as any})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline focus:outline-gray-300"
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
            <label className="block text-sm font-bold text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={createForm.description}
              onChange={(e) => setCreateForm({...createForm, description: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline focus:outline-gray-300"
              placeholder="Enter description"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              Requirements <span className="text-red-500">*</span>
            </label>
            <textarea
              value={createForm.requirements}
              onChange={(e) => setCreateForm({...createForm, requirements: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline focus:outline-gray-300"
              placeholder="Enter material requirements"
              rows={3}
              required
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
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
  );
};

export default CreateMaterialModal;
