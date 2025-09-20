import React from 'react';
import { Plus } from 'lucide-react';
import { Plan, ActiveTab } from './types';
import { filterPlansByTab } from './utils';
import PlanCard from './PlanCard';

interface PlansListProps {
  plans: Plan[];
  activeTab: ActiveTab;
  onEditPlan: (plan: Plan) => void;
  onDeletePlan: (plan: Plan) => void;
  onStartPlan: (plan: Plan) => void;
  onEndPlan: (plan: Plan) => void;
  onCreatePlanClick: () => void;
}

const PlansList: React.FC<PlansListProps> = ({
  plans,
  activeTab,
  onEditPlan,
  onDeletePlan,
  onStartPlan,
  onEndPlan,
  onCreatePlanClick,
}) => {
  const filteredPlans = filterPlansByTab(plans, activeTab);

  if (filteredPlans.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="bg-gray-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
          <Plus className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          No {activeTab} plans found
        </h3>
        <p className="text-gray-600 mb-6">
          {activeTab === 'running' && "Start a pending plan to see it here"}
          {activeTab === 'pending' && "Create a new plan to get started"}
          {activeTab === 'ended' && "Completed plans will appear here"}
        </p>
        {activeTab === 'pending' && (
          <button
            onClick={onCreatePlanClick}
            className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-all duration-200 flex items-center gap-2 mx-auto"
          >
            <Plus className="w-5 h-5" />
            Create New Plan
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {filteredPlans.map((plan) => (
        <PlanCard
          key={plan.id}
          plan={plan}
          onEdit={onEditPlan}
          onDelete={onDeletePlan}
          onStart={onStartPlan}
          onEnd={onEndPlan}
        />
      ))}
    </div>
  );
};

export default PlansList;
