import React from 'react';
import { Play, Clock, Square } from 'lucide-react';
import { Plan, ActiveTab } from './types';

interface PlansTabsProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  plans: Plan[];
}

const PlansTabs: React.FC<PlansTabsProps> = ({ activeTab, setActiveTab, plans }) => {
  const tabs = [
    {
      id: 'running' as ActiveTab,
      label: `Running Plans (${plans.filter(p => p.status === 'RUNNING').length})`,
      icon: Play,
      inactiveColor: 'text-green-500 hover:text-gray-600',
    },
    {
      id: 'pending' as ActiveTab,
      label: `Pending Plans (${plans.filter(p => p.status === 'PENDING').length})`,
      icon: Clock,
      inactiveColor: 'text-yellow-500 hover:text-yellow-600',
    },
    {
      id: 'ended' as ActiveTab,
      label: `Ended Plans (${plans.filter(p => p.status === 'ENDED').length})`,
      icon: Square,
      inactiveColor: 'text-red-500 hover:text-red-600',
    },
  ];

  return (
    <div className="mb-6">
      <div className="flex border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative flex items-center justify-center flex-1 py-4 px-1 font-medium text-sm 
                        transition-colors group
                        ${activeTab === tab.id ? 'text-blue-600 ' : tab.inactiveColor}`}
          >
            <tab.icon className="w-4 h-4 mr-2" />
            {tab.label}
            {/* Animated underline */}
            <span
              className={`absolute bottom-0 left-0 h-[2px] bg-[#3674B5] transition-all duration-300
                          ${activeTab === tab.id ? 'w-full' : 'w-0 group-hover:w-full'}`}
            />
          </button>
        ))}
      </div>
    </div>
  );
};

export default PlansTabs;
