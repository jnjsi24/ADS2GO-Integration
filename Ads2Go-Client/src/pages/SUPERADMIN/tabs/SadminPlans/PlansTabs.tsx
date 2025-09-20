import React from 'react';
import { Play, Clock, Square } from 'lucide-react';
import { Plan, ActiveTab } from './types';

interface PlansTabsProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  plans: Plan[];
}

const PlansTabs: React.FC<PlansTabsProps> = ({ activeTab, setActiveTab, plans }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border mb-6">
      <div className="flex border-b">
        <button
          onClick={() => setActiveTab('running')}
          className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
            activeTab === 'running'
              ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <Play className="w-4 h-4" />
            Running Plans ({plans.filter(p => p.status === 'RUNNING').length})
          </div>
        </button>
        <button
          onClick={() => setActiveTab('pending')}
          className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
            activeTab === 'pending'
              ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <Clock className="w-4 h-4" />
            Pending Plans ({plans.filter(p => p.status === 'PENDING').length})
          </div>
        </button>
        <button
          onClick={() => setActiveTab('ended')}
          className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
            activeTab === 'ended'
              ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <Square className="w-4 h-4" />
            Ended Plans ({plans.filter(p => p.status === 'ENDED').length})
          </div>
        </button>
      </div>
    </div>
  );
};

export default PlansTabs;
