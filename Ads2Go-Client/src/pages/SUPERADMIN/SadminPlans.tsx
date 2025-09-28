import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@apollo/client';
// SadminPlans specific GraphQL operations
import { GET_ALL_ADS_PLANS, Plan } from '../../graphql/superadmin/queries/sadminPlansQueries';
import { CREATE_ADS_PLAN, UPDATE_ADS_PLAN, DELETE_ADS_PLAN, START_ADS_PLAN, END_ADS_PLAN, AdsPlanInput, AdsPlanUpdateInput } from '../../graphql/superadmin/mutations/sadminPlansMutations';

// Import components from tabs/SadminPlans
import {
  PlansHeader,
  PlansStats,
  PlansTabs,
  PlansList,
  CreateEditPlanModal,
  PlanFormData,
  ActiveTab,
  calculatePlanPricing
} from './tabs/SadminPlans';

const SadminPlans: React.FC = () => {
  // State management
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [activeTab, setActiveTab] = useState<ActiveTab>('running');

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
  // Scheduling options
  const [startType, setStartType] = useState<'immediate' | 'scheduled'>('immediate');
  const [scheduledStartDate, setScheduledStartDate] = useState('');
  const [scheduledEndDate, setScheduledEndDate] = useState('');

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

  // Reset form function
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
    // Reset scheduling options
    setStartType('immediate');
    setScheduledStartDate('');
    setScheduledEndDate('');
  };

  // Handle form submission
  const handleFormSubmit = (formData: PlanFormData) => {
    // Validate required pricePerPlay
    if (!formData.pricePerPlayOverride || formData.pricePerPlayOverride <= 0) {
      setErrorMsg('Price per play is required and must be greater than 0');
      return;
    }

    // Validate scheduled dates if scheduled
    if (formData.startType === 'scheduled') {
      if (!formData.scheduledStartDate || !formData.scheduledEndDate) {
        setErrorMsg('Start date and end date are required for scheduled plans');
        return;
      }
      
      const startDate = new Date(formData.scheduledStartDate);
      const endDate = new Date(formData.scheduledEndDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (startDate < today) {
        setErrorMsg('Start date cannot be in the past');
        return;
      }
      
      if (endDate <= startDate) {
        setErrorMsg('End date must be after start date');
        return;
      }
    }

    // Calculate plays per day automatically (same as server logic)
    const calculatedPlaysPerDay = Math.floor((8 * 60 * 60) / formData.adLengthSeconds);
    
    const pricing = calculatePlanPricing(
      formData.numberOfDevices,
      calculatedPlaysPerDay, // Use calculated value instead of manual input
      formData.adLengthSeconds,
      formData.durationDays,
      formData.pricePerPlayOverride
    );

    // Determine plan status and dates based on scheduling
    let planStatus = 'RUNNING';
    let startDate = null;
    let endDate = null;

    if (formData.startType === 'scheduled') {
      planStatus = 'PENDING';
      startDate = new Date(formData.scheduledStartDate);
      endDate = new Date(formData.scheduledEndDate);
    } else {
      // Immediate start
      startDate = new Date();
    }

    const input: AdsPlanInput = {
      name: formData.planName,
      description: formData.planDescription,
      durationDays: formData.durationDays,
      category: formData.category as 'DIGITAL' | 'NON-DIGITAL',
      materialType: formData.materialType,
      vehicleType: formData.vehicleType as 'CAR' | 'MOTORCYCLE',
      numberOfDevices: formData.numberOfDevices,
      adLengthSeconds: formData.adLengthSeconds,
      playsPerDayPerDevice: calculatedPlaysPerDay, // Use calculated value
      pricePerPlay: formData.pricePerPlayOverride, // Required - no fallback
      status: planStatus,
      startDate: startDate,
      endDate: endDate,
    };

    if (editingPlan) {
      const updateInput: AdsPlanUpdateInput = input;
      updateAdsPlan({
        variables: {
          id: editingPlan.id,
          input: updateInput,
        },
      });
    } else {
      createAdsPlan({
        variables: { input },
      });
    }
  };

  // Handle create plan
  const handleCreatePlan = () => {
    setEditingPlan(null);
    resetForm();
    setIsModalOpen(true);
  };

  // Handle edit plan
  const handleEditPlan = (plan: Plan) => {
    setEditingPlan(plan);
    setIsModalOpen(true);
  };

  // Handle delete plan
  const handleDeletePlan = (plan: Plan) => {
    if (window.confirm('Are you sure you want to delete this plan?')) {
      deleteAdsPlan({
        variables: { id: plan.id },
      });
    }
  };

  // Handle start plan
  const handleStartPlan = (plan: Plan) => {
    startAdsPlan({
      variables: { id: plan.id },
    });
  };

  // Handle end plan
  const handleEndPlan = (plan: Plan) => {
    endAdsPlan({
      variables: { id: plan.id },
    });
  };

  // Handle modal close
  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingPlan(null);
    resetForm();
    setErrorMsg('');
  };

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
        <p className="text-red-600">Error loading plans: {error.message}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen ml-64 mb-5 bg-gray-50">
      {/* Header */}
      <PlansHeader onCreatePlanClick={handleCreatePlan} />

      {/* Stats Cards */}
      <PlansStats plans={plans} />

      {/* Error Message */}
      {errorMsg && (
        <div className="px-8">
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            {errorMsg}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="px-8">
        <PlansTabs
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          plans={plans}
        />

        {/* Plans List */}
        <PlansList
          plans={plans}
          activeTab={activeTab}
          onEditPlan={handleEditPlan}
          onDeletePlan={handleDeletePlan}
          onStartPlan={handleStartPlan}
          onEndPlan={handleEndPlan}
          onCreatePlanClick={handleCreatePlan}
        />
      </div>

      {/* Modal */}
      <CreateEditPlanModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSubmit={handleFormSubmit}
        editingPlan={editingPlan}
        errorMsg={errorMsg}
        isLoading={createLoading || updateLoading}
      />
    </div>
  );
};

export default SadminPlans;