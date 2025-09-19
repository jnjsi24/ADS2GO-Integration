import React, { useState } from 'react';
import { useQuery } from '@apollo/client';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { GET_ALL_ADS_PLANS } from '../../../graphql/admin/queries/adsPlans';
import { GET_PLAN_AVAILABILITY } from '../../../graphql/admin/planAvailability';
import PlanAvailabilityChecker from '../../../components/PlanAvailabilityChecker';

const PlanAvailabilityTab: React.FC = () => {
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [desiredStartDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });

  const { data: plansData, loading: plansLoading } = useQuery(GET_ALL_ADS_PLANS);
  const { data: availabilityData } = useQuery(
    GET_PLAN_AVAILABILITY,
    {
      variables: {
        planId: selectedPlanId,
        desiredStartDate
      },
      skip: !selectedPlanId
    }
  );

  const plans = plansData?.getAllAdsPlans || [];
  const availability = availabilityData?.getPlanAvailability;

  const handlePlanChange = (planId: string) => {
    setSelectedPlanId(planId);
  };


  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Plan Availability Checker</h1>
          <p className="text-gray-600">
            Check material availability for ad plans and prevent conflicts
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Plan Selection */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Plan</h2>
            
            {plansLoading ? (
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            ) : (
              <div className="space-y-2">
                {plans.map((plan: any) => (
                  <div
                    key={plan.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedPlanId === plan.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => handlePlanChange(plan.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900">{plan.name}</h3>
                        <p className="text-sm text-gray-600">
                          {plan.materialType} • {plan.vehicleType} • {plan.durationDays} days
                        </p>
                      </div>
                      {selectedPlanId === plan.id && (
                        <CheckCircle className="w-5 h-5 text-blue-500" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Availability Checker */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Availability Check</h2>
            
            {!selectedPlanId ? (
              <div className="text-center py-8 text-gray-500">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>Select a plan to check availability</p>
              </div>
            ) : (
              <PlanAvailabilityChecker
                planId={selectedPlanId}
                onAvailabilityChange={(canCreate, availability) => {
                  console.log('Availability changed:', { canCreate, availability });
                }}
              />
            )}
          </div>
        </div>

        {/* Detailed Availability Info */}
        {availability && (
          <div className="mt-6 bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Detailed Material Status</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {availability.materialAvailabilities.map((material) => (
                <div
                  key={material.materialId}
                  className={`p-4 border rounded-lg ${
                    material.canAcceptAd
                      ? 'border-green-200 bg-green-50'
                      : 'border-red-200 bg-red-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-gray-900">
                      {material.materialInfo.materialId}
                    </h3>
                    {material.canAcceptAd ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500" />
                    )}
                  </div>
                  
                  <div className="text-sm text-gray-600 space-y-1">
                    <div>Type: {material.materialInfo.materialType}</div>
                    <div>Vehicle: {material.materialInfo.vehicleType}</div>
                    <div>Slots: {material.availableSlots}/{material.totalSlots}</div>
                    <div>Status: {material.status}</div>
                    {material.nextAvailableDate && (
                      <div className="text-xs">
                        Next: {formatDate(material.nextAvailableDate)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Summary Stats */}
        {availability && (
          <div className="mt-6 bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Summary</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">
                  {availability.totalAvailableSlots}
                </div>
                <div className="text-sm text-gray-600">Total Available Slots</div>
              </div>
              
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">
                  {availability.availableMaterialsCount}
                </div>
                <div className="text-sm text-gray-600">Available Materials</div>
              </div>
              
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">
                  {availability.plan.materials.length}
                </div>
                <div className="text-sm text-gray-600">Plan Materials</div>
              </div>
              
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className={`text-2xl font-bold ${
                  availability.canCreate ? 'text-green-600' : 'text-red-600'
                }`}>
                  {availability.canCreate ? 'Yes' : 'No'}
                </div>
                <div className="text-sm text-gray-600">Can Create Ad</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlanAvailabilityTab;
