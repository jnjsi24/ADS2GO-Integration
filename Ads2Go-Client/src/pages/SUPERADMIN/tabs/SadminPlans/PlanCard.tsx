import React from 'react';
import { Play, Square, Edit, Trash2, Car, Bike, Monitor, Crown } from 'lucide-react';
import { Plan, getStatusBadgeClasses, getStatusIcon, getVehicleIcon, getMaterialIcon, formatCurrency } from './utils';

interface PlanCardProps {
  plan: Plan;
  onEdit: (plan: Plan) => void;
  onDelete: (plan: Plan) => void;
  onStart: (plan: Plan) => void;
  onEnd: (plan: Plan) => void;
}

const PlanCard: React.FC<PlanCardProps> = ({ plan, onEdit, onDelete, onStart, onEnd }) => {
  const StatusIcon = getStatusIcon(plan.status);
  const VehicleIcon = getVehicleIcon(plan.vehicleType);
  const MaterialIcon = getMaterialIcon(plan.materialType);

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadgeClasses(plan.status)}`}>
              {plan.status}
            </span>
          </div>
          <p className="text-gray-600 text-sm">{plan.description}</p>
        </div>
        <div className="flex items-center gap-2">
          {plan.status === 'PENDING' && (
            <button
              onClick={() => onStart(plan)}
              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
              title="Start Plan"
            >
              <Play className="w-4 h-4" />
            </button>
          )}
          {plan.status === 'RUNNING' && (
            <button
              onClick={() => onEnd(plan)}
              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="End Plan"
            >
              <Square className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => onEdit(plan)}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Edit Plan"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(plan)}
            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete Plan"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Plan Details */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="flex items-center gap-2">
          <VehicleIcon className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-600">{plan.vehicleType}</span>
        </div>
        <div className="flex items-center gap-2">
          <MaterialIcon className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-600">{plan.materialType}</span>
        </div>
        <div className="text-sm text-gray-600">
          <span className="font-medium">{plan.numberOfDevices}</span> devices
        </div>
        <div className="text-sm text-gray-600">
          <span className="font-medium">{plan.durationDays}</span> days
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div>
          <p className="text-xs text-gray-500 mb-1">Ad Length</p>
          <p className="text-sm font-medium text-gray-900">{plan.adLengthSeconds}s</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Plays/Day/Device</p>
          <p className="text-sm font-medium text-gray-900">{plan.playsPerDayPerDevice}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Total Plays/Day</p>
          <p className="text-sm font-medium text-gray-900">{plan.totalPlaysPerDay}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Price/Play</p>
          <p className="text-sm font-medium text-gray-900">{formatCurrency(plan.pricePerPlay)}</p>
        </div>
      </div>

      {/* Revenue */}
      <div className="border-t pt-4">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-xs text-gray-500 mb-1">Daily Revenue</p>
            <p className="text-lg font-semibold text-green-600">{formatCurrency(plan.dailyRevenue)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500 mb-1">Total Price</p>
            <p className="text-lg font-semibold text-gray-900">{formatCurrency(plan.totalPrice)}</p>
          </div>
        </div>
      </div>

      {/* Dates */}
      {(plan.startDate || plan.endDate) && (
        <div className="border-t pt-4 mt-4">
          <div className="flex justify-between items-center text-sm text-gray-500">
            {plan.startDate && (
              <div>
                <span className="font-medium">Started:</span> {new Date(plan.startDate).toLocaleDateString()}
              </div>
            )}
            {plan.endDate && (
              <div>
                <span className="font-medium">Ended:</span> {new Date(plan.endDate).toLocaleDateString()}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PlanCard;
