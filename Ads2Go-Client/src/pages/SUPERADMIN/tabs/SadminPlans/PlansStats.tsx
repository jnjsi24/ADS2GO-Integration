import React from 'react';
import { Crown, Play, Clock } from 'lucide-react';
import { Plan } from './utils';

interface PlansStatsProps {
  plans: Plan[];
}

const PlansStats: React.FC<PlansStatsProps> = ({ plans }) => {
  return (
    <div className="px-8 py-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Plans</p>
              <p className="text-2xl font-bold text-gray-900">{plans.length}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <Crown className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Running Plans</p>
              <p className="text-2xl font-bold text-green-600">{plans.filter(p => p.status === 'RUNNING').length}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-lg">
              <Play className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending Plans</p>
              <p className="text-2xl font-bold text-yellow-600">{plans.filter(p => p.status === 'PENDING').length}</p>
            </div>
            <div className="bg-yellow-100 p-3 rounded-lg">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
        
      </div>
    </div>
  );
};

export default PlansStats;
