//SadminPlans.tsx
//Frontend - Updated with Backend Integration

//(FIX) PUT THE MUTATIONS IN THE grahphql/queries & mutations FOLDER LATER//

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';

// GraphQL Queries and Mutations
const GET_ALL_ADS_PLANS = gql`
  query GetAllAdsPlans {
    getAllAdsPlans {
      id
      name
      description
      durationDays
      category
      materialType
      vehicleType
      numberOfDevices
      adLengthSeconds
      playsPerDayPerDevice
      totalPlaysPerDay
      pricePerPlay
      dailyRevenue
      totalPrice
      status
      startDate
      endDate
      currentDurationDays
      createdAt
      updatedAt
    }
  }
`;

const CREATE_ADS_PLAN = gql`
  mutation CreateAdsPlan($input: AdsPlanInput!) {
    createAdsPlan(input: $input) {
      id
      name
      description
      durationDays
      category
      materialType
      vehicleType
      numberOfDevices
      adLengthSeconds
      playsPerDayPerDevice
      totalPlaysPerDay
      pricePerPlay
      dailyRevenue
      totalPrice
      status
      startDate
      endDate
      currentDurationDays
      createdAt
      updatedAt
    }
  }
`;

const UPDATE_ADS_PLAN = gql`
  mutation UpdateAdsPlan($id: ID!, $input: AdsPlanUpdateInput!) {
    updateAdsPlan(id: $id, input: $input) {
      id
      name
      description
      durationDays
      category
      materialType
      vehicleType
      numberOfDevices
      adLengthSeconds
      playsPerDayPerDevice
      totalPlaysPerDay
      pricePerPlay
      dailyRevenue
      totalPrice
      status
      startDate
      endDate
      currentDurationDays
      createdAt
      updatedAt
    }
  }
`;

const DELETE_ADS_PLAN = gql`
  mutation DeleteAdsPlan($id: ID!) {
    deleteAdsPlan(id: $id)
  }
`;

const START_ADS_PLAN = gql`
  mutation StartAdsPlan($id: ID!) {
    startAdsPlan(id: $id) {
      id
      status
      startDate
    }
  }
`;

const END_ADS_PLAN = gql`
  mutation EndAdsPlan($id: ID!) {
    endAdsPlan(id: $id) {
      id
      status
      endDate
    }
  }
`;

interface Plan {
  id: string;
  name: string;
  description: string;
  durationDays: number;
  category: 'DIGITAL' | 'NON-DIGITAL';
  materialType: string;
  vehicleType: 'CAR' | 'MOTORCYCLE';
  numberOfDevices: number;
  adLengthSeconds: number;
  playsPerDayPerDevice: number;
  totalPlaysPerDay: number;
  pricePerPlay: number;
  dailyRevenue: number;
  totalPrice: number;
  status: 'PENDING' | 'RUNNING' | 'ENDED';
  startDate?: string;
  endDate?: string;
  currentDurationDays: number;
  createdAt?: string;
  updatedAt?: string;
}

const SadminPlans: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Form States
  const [planName, setPlanName] = useState('');
  const [planDescription, setPlanDescription] = useState('');
  const [durationDays, setDurationDays] = useState(30);
  const [category, setCategory] = useState<'DIGITAL' | 'NON-DIGITAL' | ''>('');
  const [materialType, setMaterialType] = useState('');
  const [vehicleType, setVehicleType] = useState<'CAR' | 'MOTORCYCLE' | ''>('');
  const [numberOfDevices, setNumberOfDevices] = useState(1);
  const [adLengthSeconds, setAdLengthSeconds] = useState(20);
  const [playsPerDayPerDevice, setPlaysPerDayPerDevice] = useState(160);
  const [pricePerPlayOverride, setPricePerPlayOverride] = useState<number | ''>('');
  const [deviceCostOverride, setDeviceCostOverride] = useState<number | ''>('');
  const [durationCostOverride, setDurationCostOverride] = useState<number | ''>('');
  const [adLengthCostOverride, setAdLengthCostOverride] = useState<number | ''>('');

  // GraphQL Hooks
  const { data, loading, error, refetch } = useQuery(GET_ALL_ADS_PLANS, {
    errorPolicy: 'all',
    fetchPolicy: 'cache-and-network'
  });

  const [createAdsPlan, { loading: createLoading }] = useMutation(CREATE_ADS_PLAN, {
    onCompleted: () => {
      setIsModalOpen(false);
      resetForm();
      refetch();
      setErrorMsg('');
    },
    onError: (error) => {
      setErrorMsg(error.message || 'Failed to create plan');
    }
  });

  const [updateAdsPlan, { loading: updateLoading }] = useMutation(UPDATE_ADS_PLAN, {
    onCompleted: () => {
      setIsModalOpen(false);
      resetForm();
      refetch();
      setErrorMsg('');
    },
    onError: (error) => {
      setErrorMsg(error.message || 'Failed to update plan');
    }
  });

  const [deleteAdsPlan] = useMutation(DELETE_ADS_PLAN, {
    onCompleted: () => {
      refetch();
    },
    onError: (error) => {
      setErrorMsg(error.message || 'Failed to delete plan');
    }
  });

  const [startAdsPlan] = useMutation(START_ADS_PLAN, {
    onCompleted: () => {
      refetch();
    },
    onError: (error) => {
      setErrorMsg(error.message || 'Failed to start plan');
    }
  });

  const [endAdsPlan] = useMutation(END_ADS_PLAN, {
    onCompleted: () => {
      refetch();
    },
    onError: (error) => {
      setErrorMsg(error.message || 'Failed to end plan');
    }
  });

  const plans: Plan[] = data?.getAllAdsPlans || [];

  // Auto-determine category based on material type
  useEffect(() => {
    if (materialType === 'LCD') {
      setCategory('DIGITAL');
    } else if (materialType === 'HEADDRESS') {
      setCategory('DIGITAL');
    }
  }, [materialType]);

  // Get available materials based on vehicle type
  const getAvailableMaterials = (vehicleType: string) => {
    if (vehicleType === 'CAR') {
      return [
        { value: 'LCD', label: 'LCD' },
        { value: 'HEADDRESS', label: 'Headdress' }
      ];
    } else if (vehicleType === 'MOTORCYCLE') {
      return [
        { value: 'LCD', label: 'LCD' }
      ];
    }
    return [];
  };

  // Get default price per play based on vehicle and material (matches backend logic)
  const getDefaultPricePerPlay = (vehicleType: string, materialType: string) => {
    if (vehicleType === 'CAR') {
      if (materialType === 'LCD') return 3;
      if (materialType === 'HEADDRESS') return 2;
    }
    if (vehicleType === 'MOTORCYCLE') {
      if (materialType === 'LCD') return 1;
    }
    return 1;
  };

  // Calculate pricing preview (matches backend logic)
  const calculatePricingPreview = () => {
    const effectivePricePerPlay = pricePerPlayOverride || 
      getDefaultPricePerPlay(vehicleType as string, materialType);
    
    const totalPlaysPerDay = playsPerDayPerDevice * numberOfDevices;
    const dailyRevenue = totalPlaysPerDay * effectivePricePerPlay;
    
    // Device cost calculation
    let deviceUnitCost = 0;
    if (deviceCostOverride) {
      deviceUnitCost = deviceCostOverride;
    } else {
      if (vehicleType === 'CAR') {
        if (materialType === 'LCD') deviceUnitCost = 4000;
        else if (materialType === 'HEADDRESS') deviceUnitCost = 1000;
      } else if (vehicleType === 'MOTORCYCLE') {
        if (materialType === 'LCD') deviceUnitCost = 2000;
      }
    }
    const deviceCost = numberOfDevices * deviceUnitCost;

    // Ad length cost
    let adLengthCost;
    if (adLengthCostOverride) {
      adLengthCost = adLengthCostOverride;
    } else {
      adLengthCost = adLengthSeconds === 20 ? 500 :
                     adLengthSeconds === 40 ? 5000 :
                     adLengthSeconds === 60 ? 10000 : 0;
    }

    // Duration cost
    const durationMonths = Math.ceil(durationDays / 30);
    let durationCostPerMonth = 0;
    if (durationCostOverride) {
      durationCostPerMonth = durationCostOverride;
    } else {
      if (vehicleType === 'CAR') {
        if (materialType === 'LCD') durationCostPerMonth = 2000;
        else if (materialType === 'HEADDRESS') durationCostPerMonth = 1500;
      } else if (vehicleType === 'MOTORCYCLE') {
        if (materialType === 'LCD') durationCostPerMonth = 1000;
      }
    }
    const durationCost = durationMonths * durationCostPerMonth;

    const totalForPlay = totalPlaysPerDay * effectivePricePerPlay * durationDays;
    const totalPrice = totalForPlay + deviceCost + durationCost + adLengthCost;

    return {
      totalPlaysPerDay,
      dailyRevenue,
      totalPrice,
      pricePerPlay: effectivePricePerPlay
    };
  };

  const pricingPreview = calculatePricingPreview();

  const handleCreatePlan = () => {
    setErrorMsg('');
    
    const input = {
      name: planName,
      description: planDescription,
      durationDays,
      category: category as string,
      materialType: materialType.toUpperCase(),
      vehicleType: vehicleType as string,
      numberOfDevices,
      adLengthSeconds,
      playsPerDayPerDevice,
      ...(pricePerPlayOverride && { pricePerPlay: pricePerPlayOverride }),
      ...(deviceCostOverride && { deviceCostOverride }),
      ...(durationCostOverride && { durationCostOverride }),
      ...(adLengthCostOverride && { adLengthCostOverride })
    };

    if (editingPlan) {
      updateAdsPlan({
        variables: {
          id: editingPlan.id,
          input
        }
      });
    } else {
      createAdsPlan({
        variables: { input }
      });
    }
  };

  const handleEditPlan = (plan: Plan) => {
    setEditingPlan(plan);
    setPlanName(plan.name);
    setPlanDescription(plan.description);
    setDurationDays(plan.durationDays);
    setCategory(plan.category);
    setMaterialType(plan.materialType);
    setVehicleType(plan.vehicleType);
    setNumberOfDevices(plan.numberOfDevices);
    setAdLengthSeconds(plan.adLengthSeconds);
    setPlaysPerDayPerDevice(plan.playsPerDayPerDevice);
    setPricePerPlayOverride('');
    setDeviceCostOverride('');
    setDurationCostOverride('');
    setAdLengthCostOverride('');
    setIsModalOpen(true);
  };

  const handleStartPlan = (planId: string) => {
    startAdsPlan({
      variables: { id: planId }
    });
  };

  const handleEndPlan = (planId: string) => {
    endAdsPlan({
      variables: { id: planId }
    });
  };

  const handleDeletePlan = (planId: string) => {
    if (window.confirm('Are you sure you want to delete this plan?')) {
      deleteAdsPlan({
        variables: { id: planId }
      });
    }
  };

  const resetForm = () => {
    setPlanName('');
    setPlanDescription('');
    setDurationDays(30);
    setCategory('');
    setMaterialType('');
    setVehicleType('');
    setNumberOfDevices(1);
    setAdLengthSeconds(20);
    setPlaysPerDayPerDevice(160);
    setPricePerPlayOverride('');
    setDeviceCostOverride('');
    setDurationCostOverride('');
    setAdLengthCostOverride('');
    setEditingPlan(null);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount);
  };

  if (loading) return <div className="p-6 ml-64">Loading plans...</div>;
  if (error) return <div className="p-6 ml-64 text-red-600">Error: {error.message}</div>;

  return (
    <div className="p-6 ml-64">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Ads Plans Management</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          + Create Plan
        </button>
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {errorMsg}
        </div>
      )}

      {/* Running Plans */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-3">Running Plans</h2>
        <div className="overflow-x-auto">
          <table className="w-full border border-gray-300">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="p-3">Plan Name</th>
                <th className="p-3">Vehicle</th>
                <th className="p-3">Material</th>
                <th className="p-3">Devices</th>
                <th className="p-3">Duration</th>
                <th className="p-3">Ad Length</th>
                <th className="p-3">Price/Play</th>
                <th className="p-3">Daily Revenue</th>
                <th className="p-3">Total Price</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {plans.filter(p => p.status === 'RUNNING').map(plan => (
                <tr key={plan.id} className="border-t hover:bg-gray-50">
                  <td className="p-3 font-medium">{plan.name}</td>
                  <td className="p-3">{plan.vehicleType}</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-xs ${
                      plan.category === 'DIGITAL' 
                        ? 'bg-blue-100 text-blue-800' 
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {plan.materialType}
                    </span>
                  </td>
                  <td className="p-3">{plan.numberOfDevices}</td>
                  <td className="p-3">{plan.durationDays} days</td>
                  <td className="p-3">{plan.adLengthSeconds}s</td>
                  <td className="p-3">{formatCurrency(plan.pricePerPlay)}</td>
                  <td className="p-3">{formatCurrency(plan.dailyRevenue)}</td>
                  <td className="p-3 font-semibold">{formatCurrency(plan.totalPrice)}</td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditPlan(plan)}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleEndPlan(plan.id)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        End
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {plans.filter(p => p.status === 'RUNNING').length === 0 && (
                <tr>
                  <td colSpan={10} className="p-6 text-center text-gray-500">
                    No running plans
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pending Plans */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-3">Pending Plans</h2>
        <div className="overflow-x-auto">
          <table className="w-full border border-gray-300">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="p-3">Plan Name</th>
                <th className="p-3">Vehicle</th>
                <th className="p-3">Material</th>
                <th className="p-3">Devices</th>
                <th className="p-3">Duration</th>
                <th className="p-3">Ad Length</th>
                <th className="p-3">Price/Play</th>
                <th className="p-3">Daily Revenue</th>
                <th className="p-3">Total Price</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {plans.filter(p => p.status === 'PENDING').map(plan => (
                <tr key={plan.id} className="border-t hover:bg-gray-50">
                  <td className="p-3 font-medium">{plan.name}</td>
                  <td className="p-3">{plan.vehicleType}</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-xs ${
                      plan.category === 'DIGITAL' 
                        ? 'bg-blue-100 text-blue-800' 
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {plan.materialType}
                    </span>
                  </td>
                  <td className="p-3">{plan.numberOfDevices}</td>
                  <td className="p-3">{plan.durationDays} days</td>
                  <td className="p-3">{plan.adLengthSeconds}s</td>
                  <td className="p-3">{formatCurrency(plan.pricePerPlay)}</td>
                  <td className="p-3">{formatCurrency(plan.dailyRevenue)}</td>
                  <td className="p-3 font-semibold">{formatCurrency(plan.totalPrice)}</td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleStartPlan(plan.id)}
                        className="text-green-600 hover:text-green-800 text-sm"
                      >
                        Start
                      </button>
                      <button
                        onClick={() => handleEditPlan(plan)}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeletePlan(plan.id)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {plans.filter(p => p.status === 'PENDING').length === 0 && (
                <tr>
                  <td colSpan={10} className="p-6 text-center text-gray-500">
                    No pending plans
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ended Plans */}
      <div>
        <h2 className="text-xl font-semibold mb-3">Ended Plans</h2>
        <div className="overflow-x-auto">
          <table className="w-full border border-gray-300">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="p-3">Plan Name</th>
                <th className="p-3">Vehicle</th>
                <th className="p-3">Material</th>
                <th className="p-3">Devices</th>
                <th className="p-3">Duration</th>
                <th className="p-3">Total Price</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {plans.filter(p => p.status === 'ENDED').map(plan => (
                <tr key={plan.id} className="border-t hover:bg-gray-50 opacity-75">
                  <td className="p-3 font-medium">{plan.name}</td>
                  <td className="p-3">{plan.vehicleType}</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-xs ${
                      plan.category === 'DIGITAL' 
                        ? 'bg-blue-100 text-blue-800' 
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {plan.materialType}
                    </span>
                  </td>
                  <td className="p-3">{plan.numberOfDevices}</td>
                  <td className="p-3">{plan.durationDays} days</td>
                  <td className="p-3 font-semibold">{formatCurrency(plan.totalPrice)}</td>
                  <td className="p-3">
                    <button
                      onClick={() => handleDeletePlan(plan.id)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {plans.filter(p => p.status === 'ENDED').length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-gray-500">
                    No ended plans
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
            <h2 className="text-lg font-semibold mb-4">
              {editingPlan ? 'Edit Plan' : 'Create New Plan'}
            </h2>

            {errorMsg && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                {errorMsg}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Plan Name */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Plan Name</label>
                <input
                  type="text"
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Enter plan name"
                  required
                />
              </div>

              {/* Plan Description */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={planDescription}
                  onChange={(e) => setPlanDescription(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Enter description"
                  rows={3}
                  required
                />
              </div>

              {/* Vehicle Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Type</label>
                <select
                  value={vehicleType}
                  onChange={(e) => {
                    setVehicleType(e.target.value as 'CAR' | 'MOTORCYCLE');
                    setMaterialType('');
                  }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                >
                  <option value="">Select vehicle type</option>
                  <option value="CAR">Car</option>
                  <option value="MOTORCYCLE">Motorcycle</option>
                </select>
              </div>

              {/* Material Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Material Type</label>
                <select
                  value={materialType}
                  onChange={(e) => setMaterialType(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  disabled={!vehicleType}
                  required
                >
                  <option value="">Select material</option>
                  {getAvailableMaterials(vehicleType).map(material => (
                    <option key={material.value} value={material.value}>
                      {material.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Category (Auto-determined) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <input
                  type="text"
                  value={category}
                  disabled
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-100"
                  placeholder="Auto-determined"
                />
              </div>

              {/* Number of Devices */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Number of Devices</label>
                <input
                  type="number"
                  value={numberOfDevices}
                  onChange={(e) => setNumberOfDevices(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  min="1"
                  required
                />
              </div>

              {/* Duration Days */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duration (days)</label>
                <select
                  value={durationDays}
                  onChange={(e) => setDurationDays(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  {[30, 60, 90, 120, 150, 180].map((d) => (
                    <option key={d} value={d}>{d} days</option>
                  ))}
                </select>
              </div>

              {/* Ad Length */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ad Length (seconds)</label>
                <select
                  value={adLengthSeconds}
                  onChange={(e) => setAdLengthSeconds(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  {[20, 40, 60].map((d) => (
                    <option key={d} value={d}>{d} seconds</option>
                  ))}
                </select>
              </div>

              {/* Plays Per Day Per Device */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Plays/Day/Device</label>
                <input
                  type="number"
                  value={playsPerDayPerDevice}
                  onChange={(e) => setPlaysPerDayPerDevice(Math.max(1, parseInt(e.target.value) || 160))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  min="1"
                />
              </div>

              {/* Override Fields */}
              <div className="md:col-span-2">
                <h3 className="text-md font-medium text-gray-800 mb-2">Cost Overrides (Optional)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Price per Play Override</label>
                    <input
                      type="number"
                      value={pricePerPlayOverride}
                      onChange={(e) => setPricePerPlayOverride(e.target.value ? Number(e.target.value) : '')}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      placeholder={`Default: ₱${getDefaultPricePerPlay(vehicleType, materialType)}`}
                      step="0.01"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Device Cost Override</label>
                    <input
                      type="number"
                      value={deviceCostOverride}
                      onChange={(e) => setDeviceCostOverride(e.target.value ? Number(e.target.value) : '')}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      placeholder="Auto-calculated"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Duration Cost Override</label>
                    <input
                      type="number"
                      value={durationCostOverride}
                      onChange={(e) => setDurationCostOverride(e.target.value ? Number(e.target.value) : '')}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      placeholder="Auto-calculated"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Ad Length Cost Override</label>
                    <input
                      type="number"
                      value={adLengthCostOverride}
                      onChange={(e) => setAdLengthCostOverride(e.target.value ? Number(e.target.value) : '')}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      placeholder="Auto-calculated"
                    />
                  </div>
                </div>
              </div>

              {/* Pricing Preview */}
              {vehicleType && materialType && (
                <div className="md:col-span-2">
                  <h3 className="text-md font-medium text-gray-800 mb-2">Pricing Preview</h3>
                  <div className="bg-gray-50 p-4 rounded-lg grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <span className="text-sm text-gray-600">Total Plays/Day:</span>
                      <div className="font-semibold">{pricingPreview.totalPlaysPerDay.toLocaleString()}</div>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Daily Revenue:</span>
                      <div className="font-semibold">{formatCurrency(pricingPreview.dailyRevenue)}</div>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Total Price:</span>
                      <div className="font-bold text-blue-600">{formatCurrency(pricingPreview.totalPrice)}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  resetForm();
                }}
                className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePlan}
                disabled={!planName || !vehicleType || !materialType || createLoading || updateLoading}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {(createLoading || updateLoading) 
                  ? 'Processing...' 
                  : editingPlan 
                    ? 'Update Plan' 
                    : 'Create Plan'
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SadminPlans;