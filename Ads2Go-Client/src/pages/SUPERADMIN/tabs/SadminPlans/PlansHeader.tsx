import React from 'react';
import { Plus } from 'lucide-react';

interface PlansHeaderProps {
  onCreatePlanClick: () => void;
}

const PlansHeader: React.FC<PlansHeaderProps> = ({ onCreatePlanClick }) => {
  return (
    <div className="bg-white shadow-sm border-b">
      <div className="px-8 py-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Ads Plans Management</h1>
            <p className="text-gray-600 mt-1">Create and manage advertising plans for vehicles</p>
          </div>
          <button
            onClick={onCreatePlanClick}
            className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-xl"
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
