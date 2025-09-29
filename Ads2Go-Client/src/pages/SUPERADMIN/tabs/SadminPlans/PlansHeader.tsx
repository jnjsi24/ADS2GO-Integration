import React from 'react';
import { Plus } from 'lucide-react';

interface PlansHeaderProps {
  onCreatePlanClick: () => void;
}

const PlansHeader: React.FC<PlansHeaderProps> = ({ onCreatePlanClick }) => {
  return (
    <div>
      <div className="px-8 py-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Ads Plan Management</h1>
          </div>
          <button
            onClick={onCreatePlanClick}
            className="py-3 bg-[#3674B5] text-xs text-white rounded-lg w-40 hover:bg-[#3674B5] hover:scale-105 transition-all duration-300 flex items-center justify-center gap-2"
            >
            <Plus className="w-5 h-5" />
            Create New Plan
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlansHeader;
