import React, { useState } from 'react';
import { useQuery } from '@apollo/client';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { GET_ALL_ADS_PLANS } from '../../../../graphql/admin/queries/adsPlans';
import { GET_PLAN_AVAILABILITY } from '../../../../graphql/admin/planAvailability';
import PlanAvailabilityChecker from '../../../../components/PlanAvailabilityChecker';

const PlanAvailabilityTab: React.FC = () => {
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [desiredStartDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [canCreateAd, setCanCreateAd] = useState<boolean | null>(null);

  const { data: plansData, loading: plansLoading } = useQuery(GET_ALL_ADS_PLANS);
  const { data: availabilityData, loading: availabilityLoading } = useQuery(
    GET_PLAN_AVAILABILITY,
    {
      variables: {
        planId: selectedPlanId,
        desiredStartDate
      },
      skip: !selectedPlanId,
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
    <div className="flex flex-col lg:flex-row gap-2">
      {/* Left Side: Plan Selection */}
      <div className="w-full lg:w-1/3 flex-shrink-0">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Select Plan</h2>
          
          {plansLoading ? (
            <div className="space-y-4 animate-pulse">
              <div className="h-16 bg-gray-200 rounded-lg"></div>
              <div className="h-16 bg-gray-200 rounded-lg"></div>
              <div className="h-16 bg-gray-200 rounded-lg"></div>
            </div>
          ) : (
            <div className="space-y-2 max-h-full overflow-y-auto pr-2">
              {plans.map((plan: any) => (
                <div
                  key={plan.id}
                  className={`p-4 border shadow-md rounded-lg cursor-pointer transition-colors ${
                    selectedPlanId === plan.id
                       ? 'border-gray-400 bg-white/10'
                      : 'hover:border-gray-400 hover:bg-white/10 bg-white'
                  }`}
                  onClick={() => handlePlanChange(plan.id)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">{plan.name}</h3>
                      
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Side: Availability Details */}
      <div className="w-full lg:w-2/3">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Material Slot Checker</h2>
          
          {/* Summary Stats */}
          {selectedPlanId && availability && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-3xl font-bold text-gray-900">
                  {availability.totalAvailableSlots}
                </div>
                <div className="text-sm text-gray-600">Total Available Slot</div>
              </div>
              
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-3xl font-bold text-gray-900">
                  {availability.availableMaterialsCount}
                </div>
                <div className="text-sm text-gray-600">Available Material</div>
              </div>
              
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-3xl font-bold text-gray-900">
                  {availability.plan.materials.length}
                </div>
                <div className="text-sm text-gray-600">Plan Material</div>
              </div>
              
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className={`text-3xl font-bold ${
                  availability.canCreate ? 'text-green-600' : 'text-red-600'
                }`}>
                  {availability.canCreate ? 'Yes' : 'No'}
                </div>
                <div className="text-sm text-gray-600">Can Create Ad</div>
              </div>
            </div>
          )}
          
          {/* Availability Checker Component */}
          <div className="mb-8">
            {!selectedPlanId ? (
              <div className="text-center py-8 text-gray-500">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>Select a plan to check availability</p>
              </div>
            ) : (
              <PlanAvailabilityChecker
                planId={selectedPlanId}
                onAvailabilityChange={(canCreate) => {
                  setCanCreateAd(canCreate);
                }}
              />
            )}
          </div>

          {/* Detailed Availability Info */}
          {selectedPlanId && availability && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Detailed Material Status</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                {availability.materialAvailabilities.map((material: any) => (
                  <div
                    key={material.materialId}
                    className={`p-4 border rounded-lg text-center ${
                      material.canAcceptAd
                        ? 'border-green-200 bg-green-50'
                        : 'border-red-200 bg-red-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium justify-center text-gray-900">
                        {material.materialInfo.materialId}
                      </h4>
                      {material.canAcceptAd ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-500" />
                      )}
                    </div>
                    
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-gray-700 rounded-lg">
                        <tbody>
                          <tr className="border-b border-gray-200">
                            <td className="py-2">Type</td>
                            <td className="px-3 py-2 font-medium text-black">{material.materialInfo.materialType}</td>
                          </tr>
                          <tr className="border-b border-gray-200">
                            <td className="py-2">Vehicle</td>
                            <td className="px-3 py-2 font-medium text-black">{material.materialInfo.vehicleType}</td>
                          </tr>
                          <tr className="border-b border-gray-200">
                            <td className="py-2">Slots</td>
                            <td className="px-3 py-2 font-medium text-black">
                              {material.availableSlots}/{material.totalSlots}
                            </td>
                          </tr>
                          <tr className="border-b border-gray-200">
                            <td className="py-2">Status</td>
                            <td className="px-3 py-2 font-medium text-black">{material.status}</td>
                          </tr>

                          {material.nextAvailableDate && (
                            <tr>
                              <td className="py-2">Next</td>
                              <td className="px-3 py-2 font-medium text-black">{formatDate(material.nextAvailableDate)}</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlanAvailabilityTab;