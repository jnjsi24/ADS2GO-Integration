import React, { useState } from 'react';
import { useQuery } from '@apollo/client';
import { Calendar, CheckCircle, XCircle, Clock } from 'lucide-react';
import { GET_PLAN_AVAILABILITY, PlanAvailability } from '../graphql/admin/planAvailability';

interface PlanAvailabilityCheckerProps {
  planId: string;
  onAvailabilityChange?: (canCreate: boolean, availability: PlanAvailability | null) => void;
}

const PlanAvailabilityChecker: React.FC<PlanAvailabilityCheckerProps> = ({
  planId,
  onAvailabilityChange
}) => {
  const [desiredStartDate, setDesiredStartDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });

  const { data, loading, error, refetch } = useQuery(GET_PLAN_AVAILABILITY, {
    variables: {
      planId,
      desiredStartDate
    },
    skip: !planId,
    onCompleted: (data) => {
      if (onAvailabilityChange) {
        onAvailabilityChange(data.getPlanAvailability.canCreate, data.getPlanAvailability);
      }
    }
  });

  const handleDateChange = (newDate: string) => {
    setDesiredStartDate(newDate);
    refetch({
      planId,
      desiredStartDate: newDate
    });
  };

  if (loading) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-8 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center text-red-600">
          <XCircle className="w-5 h-5 mr-2" />
          <span className="font-medium">Error checking availability</span>
        </div>
        <p className="text-red-500 text-sm mt-1">{error.message}</p>
      </div>
    );
  }

  const availability = data?.getPlanAvailability;

  if (!availability) {
    return null;
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="p-4 bg-white border rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Plan Availability</h3>
        <div className="flex items-center space-x-2">
          <Calendar className="w-5 h-5 text-gray-400" />
          <input
            type="date"
            value={desiredStartDate}
            onChange={(e) => handleDateChange(e.target.value)}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            min={new Date().toISOString().split('T')[0]}
          />
        </div>
      </div>

      {/* Plan Info */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
        <h4 className="font-medium text-gray-900 mb-2">{availability.plan.name}</h4>
        <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
          <div>Duration: {availability.plan.durationDays} days</div>
          <div>Devices: {availability.plan.numberOfDevices}</div>
          <div>Material: {availability.plan.materialType}</div>
          <div>Vehicle: {availability.plan.vehicleType}</div>
        </div>
      </div>

      {/* Availability Status */}
      <div className={`p-3 rounded-lg mb-4 ${
        availability.canCreate 
          ? 'bg-green-50 border border-green-200' 
          : 'bg-red-50 border border-red-200'
      }`}>
        <div className="flex items-center">
          {availability.canCreate ? (
            <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
          ) : (
            <XCircle className="w-5 h-5 text-red-600 mr-2" />
          )}
          <span className={`font-medium ${
            availability.canCreate ? 'text-green-800' : 'text-red-800'
          }`}>
            {availability.canCreate ? 'Available' : 'Not Available'}
          </span>
        </div>
        <p className={`text-sm mt-1 ${
          availability.canCreate ? 'text-green-600' : 'text-red-600'
        }`}>
          {availability.canCreate 
            ? `${availability.totalAvailableSlots} slots available across ${availability.availableMaterialsCount} materials`
            : `Next available: ${formatDate(availability.nextAvailableDate)}`
          }
        </p>
      </div>

      {/* Material Details */}
      <div className="space-y-2">
        <h4 className="font-medium text-gray-900">Material Status</h4>
        {availability.materialAvailabilities.map((material) => (
          <div key={material.materialId} className="flex items-center justify-between p-2 bg-gray-50 rounded">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${
                material.canAcceptAd ? 'bg-green-500' : 'bg-red-500'
              }`} />
              <span className="text-sm font-medium">
                {material.materialInfo.materialId}
              </span>
              <span className="text-xs text-gray-500">
                ({material.materialInfo.materialType} - {material.materialInfo.vehicleType})
              </span>
            </div>
            <div className="text-sm text-gray-600">
              {material.availableSlots}/{material.totalSlots} slots
            </div>
          </div>
        ))}
      </div>

      {/* Next Available Info */}
      {!availability.canCreate && availability.nextAvailableDate && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center text-yellow-800">
            <Clock className="w-4 h-4 mr-2" />
            <span className="text-sm font-medium">Next Available</span>
          </div>
          <p className="text-yellow-700 text-sm mt-1">
            Materials will be available starting {formatDate(availability.nextAvailableDate)}
          </p>
        </div>
      )}
    </div>
  );
};

export default PlanAvailabilityChecker;
