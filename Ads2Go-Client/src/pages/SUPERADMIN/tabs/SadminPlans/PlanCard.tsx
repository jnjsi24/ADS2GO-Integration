import React from 'react';
import { Play, Square, Pencil, Trash2, Bike, Car } from 'lucide-react';
import {
  Plan,
  getStatusBadgeClasses,
  formatCurrency,
  formatDate,
} from './utils';

interface PlanCardProps {
  plan: Plan;
  onEdit: (plan: Plan) => void;
  onDelete: (plan: Plan) => void;
  onStart: (plan: Plan) => void;
  onEnd: (plan: Plan) => void;
}

const PlanCard: React.FC<PlanCardProps> = ({
  plan,
  onEdit,
  onDelete,
  onStart,
  onEnd,
}) => {
  return (
    <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-md transition-shadow flex flex-col h-full">
      {/* === Content Wrapper (flex-1 takes available space) === */}
      <div className="flex-1 flex flex-col">
        {/* === Row 1 : TITLE + ACTION BUTTONS === */}
        <div className="flex justify-between items-center mb-4">
          {/* Title on the left */}
          <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>

          {/* Action buttons on the right */}
          <div className="flex items-center gap-2">
            {plan.status === 'PENDING' && (
              <button
                onClick={() => onStart(plan)}
                className="group flex items-center bg-green-200 hover:bg-green-200 text-green-700 rounded-md overflow-hidden shadow-md h-8 w-8 hover:w-14 transition-[width] duration-300"
              >
                <Play className="w-4 h-4 flex-shrink-0 mx-auto ml-2 group-hover:ml-1 transition-all duration-300" />
                <span className="opacity-0 group-hover:opacity-100 ml-1 group-hover:mr-2 whitespace-nowrap text-xs transition-all duration-300">
                  Start
                </span>
              </button>
            )}
            {plan.status === 'RUNNING' && (
              <button
                onClick={() => onEnd(plan)}
                className="group flex items-center bg-red-200 hover:bg-red-200 text-red-700 rounded-md overflow-hidden shadow-md h-8 w-8 hover:w-14 transition-[width] duration-300"
              >
                <Square className="w-4 h-4 flex-shrink-0 mx-auto ml-2 group-hover:ml-1 transition-all duration-300" />
                <span className="opacity-0 group-hover:opacity-100 ml-1 group-hover:mr-2 whitespace-nowrap text-xs transition-all duration-300">
                  End
                </span>
              </button>
            )}
            <button
              onClick={() => onEdit(plan)}
              className="group flex items-center hover:text-gray-700 text-gray-600 rounded-md overflow-hidden h-8 w-8 hover:w-14 transition-[width] duration-300"
            >
              <Pencil className="w-4 h-4 flex-shrink-0 mx-auto ml-2 group-hover:ml-1 transition-all duration-300" />
              <span className="opacity-0 group-hover:opacity-100 ml-1 group-hover:mr-2 whitespace-nowrap text-xs transition-all duration-300">
                Edit
              </span>
            </button>
            <button
              onClick={() => onDelete(plan)}
              className="group flex items-center hover:text-red-700 text-red-600 rounded-md overflow-hidden h-8 w-8 hover:w-16 transition-[width] duration-300"
            >
              <Trash2 className="w-4 h-4 flex-shrink-0 mx-auto ml-2 group-hover:ml-1 transition-all duration-300" />
              <span className="opacity-0 group-hover:opacity-100 ml-1 group-hover:mr-2 whitespace-nowrap text-xs transition-all duration-300">
                Delete
              </span>
            </button>
          </div>
        </div>

        {/* === Row 2 : STATUS + AD LENGTH + PRICE/PLAY === */}
        <div className="flex flex-wrap mb-4 gap-1">
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadgeClasses(
              plan.status
            )}`}
          >
            {plan.status}
          </span>

          <p className="text-xs bg-gray-100 px-3 py-1 rounded-full text-gray-700">
            <span className="font-semibold">{plan.numberOfDevices}</span> Device/s
          </p>
          <p className="text-xs bg-gray-100 px-3 py-1 rounded-full text-gray-700">
            <span className="font-semibold">
              {formatCurrency(plan.pricePerPlay)}
            </span>{' '}
            /play
          </p>
        </div>

        {/* === Row 3 : DESCRIPTION === */}
        <p className="text-sm mb-4">{plan.description}</p>

        {/* === Circle + Performance Metrics (STICKY ABOVE FOOTER) === */}
        <div className="mt-auto grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* === Column 1 : Circle Progress === */}
          <div className="flex flex-col items-center justify-center">
            <div className="relative flex items-center justify-center">
              {/* Outer circle with progress */}
              <svg className="w-32 h-32 -rotate-90">
                <circle
                  className="text-gray-200"
                  strokeWidth="10"
                  stroke="currentColor"
                  fill="transparent"
                  r="50"
                  cx="64"
                  cy="64"
                />
                <circle
                  className="text-blue-500"
                  strokeWidth="10"
                  strokeDasharray={2 * Math.PI * 50}
                  strokeDashoffset={
                    2 * Math.PI * 50 * (1 - plan.durationDays / 120)
                  }
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="transparent"
                  r="50"
                  cx="64"
                  cy="64"
                />
              </svg>

              {/* Center content (Vehicle icon + Material Type) */}
              <div className="absolute flex flex-col items-center justify-center text-center">
                {plan.vehicleType === 'MOTORCYCLE' ? (
                  <Bike className="w-7 h-7 text-gray-700 mb-1" />
                ) : (
                  <Car className="w-7 h-7 text-gray-700 mb-1" />
                )}
                <span className="text-xs font-semibold text-gray-800">
                  {plan.materialType}
                </span>
              </div>
            </div>

            {/* Duration Days below the circle */}
            <p className="mt-3 text-lg font-bold text-gray-900">
              {plan.durationDays} days
            </p>
          </div>

          {/* === Column 2 : Performance Metrics === */}
          <div className="grid grid-cols-1 justify-end gap-6">
            <div>
              <p className="text-xs text-gray-500 mb-1">Ad length</p>
              <p className="text-xl font-bold text-gray-900">
                {plan.adLengthSeconds} <span className="text-sm">seconds</span>
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Daily Play</p>
              <p className="text-xl font-bold text-gray-900">
                {plan.totalPlaysPerDay}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Device Plays/Day</p>
              <p className="text-xl font-bold text-gray-900">
                {plan.playsPerDayPerDevice}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* === Footer: Revenue + Dates === */}
      <div className="border-t pt-4 mt-auto">
        <div className="flex justify-between items-center mb-2">
          <div>
            <p className="text-xs text-gray-500 mb-1">Daily Revenue</p>
            <p className="text-lg font-semibold text-green-600">
              {formatCurrency(plan.dailyRevenue)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500 mb-1">Total Price</p>
            <p className="text-lg font-semibold text-gray-900">
              {formatCurrency(plan.totalPrice)}
            </p>
          </div>
        </div>
        {(plan.startDate || plan.endDate) && (
          <div className="flex justify-between items-center text-sm text-gray-500">
            {plan.startDate && (
              <div>
                <span className="font-medium">Started:</span>{' '}
                {formatDate(plan.startDate)}
              </div>
            )}
            {plan.endDate && (
              <div>
                <span className="font-medium">Ended:</span>{' '}
                {formatDate(plan.endDate)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PlanCard;
