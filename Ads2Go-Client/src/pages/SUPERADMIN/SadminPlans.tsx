//SadminPlans.tsx
//Frontend - Updated with Backend Integration

//(FIX) PUT THE MUTATIONS IN THE grahphql/queries & mutations FOLDER LATER//

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import { Plus, Play, Square, Edit, Trash2, DollarSign, Clock, Car, Monitor, Crown, Bike } from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState<'running' | 'pending' | 'ended'>('running');

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'RUNNING':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'ENDED':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'RUNNING':
        return <Play className="w-4 h-4" />;
      case 'PENDING':
        return <Clock className="w-4 h-4" />;
      case 'ENDED':
        return <Square className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getVehicleIcon = (vehicleType: string) => {
    return vehicleType === 'CAR' ? <Car className="w-4 h-4" /> : <Bike className="w-4 h-4" />;
  };

  const getMaterialIcon = (materialType: string) => {
    return materialType === 'LCD' ? <Monitor className="w-4 h-4" /> : <Crown className="w-4 h-4" />;
  };

  const filteredPlans = plans.filter(plan => {
    switch (activeTab) {
      case 'running':
        return plan.status === 'RUNNING';
      case 'pending':
        return plan.status === 'PENDING';
      case 'ended':
        return plan.status === 'ENDED';
      default:
        return true;
    }
  });

  if (loading) return (
    <div className="min-h-screen ml-64 bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading plans...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen ml-64 bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="text-red-500 text-6xl mb-4">⚠️</div>
        <h2 className="text-xl font-semibold text-gray-800 mb-2">Error Loading Plans</h2>
        <p className="text-gray-600">{error.message}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen ml-64 bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Ads Plans Management</h1>
              <p className="text-gray-600 mt-1">Create and manage advertising plans for vehicles</p>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-xl"
            >
              <Plus className="w-5 h-5" />
              Create New Plan
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm border">
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
          
          <div className="bg-white rounded-xl p-6 shadow-sm border">
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
          
          <div className="bg-white rounded-xl p-6 shadow-sm border">
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
          
          <div className="bg-white rounded-xl p-6 shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(plans.reduce((sum, plan) => sum + plan.totalPrice, 0))}
                </p>
              </div>
              <div className="bg-green-100 p-3 rounded-lg">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {errorMsg && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            {errorMsg}
          </div>
        )}

        {/* Tabs */}
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

        {/* Plans Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredPlans.map(plan => (
            <div key={plan.id} className="bg-white rounded-xl shadow-sm border hover:shadow-md transition-shadow duration-200">
              <div className="p-6">
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{plan.name}</h3>
                    <p className="text-sm text-gray-600 line-clamp-2">{plan.description}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(plan.status)}`}>
                    {getStatusIcon(plan.status)}
                    {plan.status}
                  </span>
                </div>

                {/* Plan Details */}
                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      {getVehicleIcon(plan.vehicleType)}
                      {plan.vehicleType}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      {getMaterialIcon(plan.materialType)}
                      {plan.materialType}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Devices</p>
                      <p className="font-medium">{plan.numberOfDevices}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Duration</p>
                      <p className="font-medium">{plan.durationDays} days</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Ad Length</p>
                      <p className="font-medium">{plan.adLengthSeconds}s</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Price/Play</p>
                      <p className="font-medium">{formatCurrency(plan.pricePerPlay)}</p>
                    </div>
                  </div>
                </div>

                {/* Revenue Info */}
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Daily Revenue</p>
                      <p className="font-semibold text-green-600">{formatCurrency(plan.dailyRevenue)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Total Price</p>
                      <p className="font-bold text-blue-600">{formatCurrency(plan.totalPrice)}</p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  {plan.status === 'PENDING' && (
                    <>
                      <button
                        onClick={() => handleStartPlan(plan.id)}
                        className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                      >
                        <Play className="w-4 h-4" />
                        Start
                      </button>
                      <button
                        onClick={() => handleEditPlan(plan)}
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <Edit className="w-4 h-4 text-gray-600" />
                      </button>
                      <button
                        onClick={() => handleDeletePlan(plan.id)}
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </>
                  )}
                  
                  {plan.status === 'RUNNING' && (
                    <>
                      <button
                        onClick={() => handleEndPlan(plan.id)}
                        className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                      >
                        <Square className="w-4 h-4" />
                        End
                      </button>
                      <button
                        onClick={() => handleEditPlan(plan)}
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <Edit className="w-4 h-4 text-gray-600" />
                      </button>
                    </>
                  )}
                  
                  {plan.status === 'ENDED' && (
                    <button
                      onClick={() => handleDeletePlan(plan.id)}
                      className="w-full bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {filteredPlans.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">📋</div>
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
                onClick={() => setIsModalOpen(true)}
                className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-all duration-200 flex items-center gap-2 mx-auto"
              >
                <Plus className="w-5 h-5" />
                Create Your First Plan
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white border-b px-8 py-6 rounded-t-2xl">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">
                  {editingPlan ? 'Edit Plan' : 'Create New Plan'}
                </h2>
                <button
                  onClick={() => {
                    setIsModalOpen(false);
                    resetForm();
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-8">
              {errorMsg && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  {errorMsg}
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column - Basic Info */}
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Basic Information</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Plan Name</label>
                    <input
                      type="text"
                      value={planName}
                      onChange={(e) => setPlanName(e.target.value)}
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="Enter plan name"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                    <textarea
                      value={planDescription}
                      onChange={(e) => setPlanDescription(e.target.value)}
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="Enter description"
                      rows={3}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Vehicle Type</label>
                      <select
                        value={vehicleType}
                        onChange={(e) => {
                          setVehicleType(e.target.value as 'CAR' | 'MOTORCYCLE');
                          setMaterialType('');
                        }}
                        className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        required
                      >
                        <option value="">Select vehicle</option>
                        <option value="CAR">Car</option>
                        <option value="MOTORCYCLE">Motorcycle</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Material Type</label>
                      <select
                        value={materialType}
                        onChange={(e) => setMaterialType(e.target.value)}
                        className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
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
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Number of Devices</label>
                      <input
                        type="number"
                        value={numberOfDevices}
                        onChange={(e) => setNumberOfDevices(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        min="1"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Duration (days)</label>
                      <select
                        value={durationDays}
                        onChange={(e) => setDurationDays(Number(e.target.value))}
                        className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      >
                        {[30, 60, 90, 120, 150, 180].map((d) => (
                          <option key={d} value={d}>{d} days</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Ad Length (seconds)</label>
                      <select
                        value={adLengthSeconds}
                        onChange={(e) => setAdLengthSeconds(Number(e.target.value))}
                        className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      >
                        {[20, 40, 60].map((d) => (
                          <option key={d} value={d}>{d} seconds</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Plays/Day/Device</label>
                      <input
                        type="number"
                        value={playsPerDayPerDevice}
                        onChange={(e) => setPlaysPerDayPerDevice(Math.max(1, parseInt(e.target.value) || 160))}
                        className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        min="1"
                      />
                    </div>
                  </div>
                </div>

                {/* Right Column - Pricing & Preview */}
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Pricing & Configuration</h3>
                  
                  {/* Category (Auto-determined) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                    <input
                      type="text"
                      value={category}
                      disabled
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 bg-gray-50 text-gray-600"
                      placeholder="Auto-determined"
                    />
                  </div>

                  {/* Cost Overrides */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Cost Overrides (Optional)</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Price per Play Override</label>
                        <input
                          type="number"
                          value={pricePerPlayOverride}
                          onChange={(e) => setPricePerPlayOverride(e.target.value ? Number(e.target.value) : '')}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder={`Default: ₱${getDefaultPricePerPlay(vehicleType, materialType)}`}
                          step="0.01"
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Device Cost Override</label>
                          <input
                            type="number"
                            value={deviceCostOverride}
                            onChange={(e) => setDeviceCostOverride(e.target.value ? Number(e.target.value) : '')}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Auto-calculated"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Duration Cost Override</label>
                          <input
                            type="number"
                            value={durationCostOverride}
                            onChange={(e) => setDurationCostOverride(e.target.value ? Number(e.target.value) : '')}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Auto-calculated"
                          />
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Ad Length Cost Override</label>
                        <input
                          type="number"
                          value={adLengthCostOverride}
                          onChange={(e) => setAdLengthCostOverride(e.target.value ? Number(e.target.value) : '')}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Auto-calculated"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Pricing Preview */}
                  {vehicleType && materialType && (
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
                      <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-blue-600" />
                        Pricing Preview
                      </h4>
                      <div className="grid grid-cols-1 gap-4">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Total Plays/Day:</span>
                          <span className="font-semibold text-gray-900">{pricingPreview.totalPlaysPerDay.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Daily Revenue:</span>
                          <span className="font-semibold text-green-600">{formatCurrency(pricingPreview.dailyRevenue)}</span>
                        </div>
                        <div className="flex justify-between items-center pt-3 border-t border-blue-200">
                          <span className="text-lg font-medium text-gray-900">Total Price:</span>
                          <span className="text-xl font-bold text-blue-600">{formatCurrency(pricingPreview.totalPrice)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-4 mt-8 pt-6 border-t">
                <button
                  onClick={() => {
                    setIsModalOpen(false);
                    resetForm();
                  }}
                  className="px-6 py-3 rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreatePlan}
                  disabled={!planName || !vehicleType || !materialType || createLoading || updateLoading}
                  className="px-8 py-3 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium flex items-center gap-2"
                >
                  {(createLoading || updateLoading) ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      {editingPlan ? 'Update Plan' : 'Create Plan'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SadminPlans;