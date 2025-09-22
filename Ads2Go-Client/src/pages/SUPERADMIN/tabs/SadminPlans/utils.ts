import { Plan, MaterialOption, ActiveTab } from './types';

// Get material type options based on category
export const getMaterialTypeOptions = (category: string): MaterialOption[] => {
  if (category === 'DIGITAL') {
    return [
      { value: 'LCD', label: 'LCD' },
      { value: 'HEADDRESS', label: 'Headdress' }
    ];
  } else if (category === 'NON-DIGITAL') {
    return [
      { value: 'LCD', label: 'LCD' }
    ];
  }
  return [];
};

// Get maximum devices based on vehicle and material type
export const getMaxDevices = (vehicleType: string, materialType: string): number => {
  if (vehicleType === 'CAR') {
    if (materialType === 'LCD') return 3;
    if (materialType === 'HEADDRESS') return 2;
  }
  if (vehicleType === 'MOTORCYCLE') {
    if (materialType === 'LCD') return 1;
  }
  return 1;
};

// Calculate plays per day based on screen hours and ad slots (matches server logic)
const calculatePlaysPerDay = (adLengthSeconds: number, screenHoursPerDay: number = 8, adSlotsPerDevice: number = 5): number => {
  // Convert screen hours to seconds
  const screenSecondsPerDay = screenHoursPerDay * 60 * 60; // 8 hours = 28,800 seconds
  
  // Calculate how many times each ad slot can play in a day
  // Each slot plays DIFFERENT ads, so we calculate per slot, not total
  const playsPerSlotPerDay = Math.floor(screenSecondsPerDay / adLengthSeconds);
  
  // Each ad gets played in ONE slot, so plays per device = plays per slot
  // (not multiplied by number of slots since each slot has different ads)
  return playsPerSlotPerDay;
};

// Calculate plan pricing (simplified - no overrides needed)
export const calculatePlanPricing = (
  numberOfDevices: number,
  playsPerDayPerDevice: number, // This parameter is ignored - we calculate it automatically
  adLengthSeconds: number,
  durationDays: number,
  pricePerPlayOverride?: number | ''
) => {
  // Calculate plays per day automatically based on 8-hour screen time
  const calculatedPlaysPerDay = calculatePlaysPerDay(adLengthSeconds);
  const totalPlaysPerDay = numberOfDevices * calculatedPlaysPerDay;
  
  // Use the provided price per play (required field)
  const pricePerPlay = pricePerPlayOverride || 0;
  
  const dailyRevenue = totalPlaysPerDay * pricePerPlay;
  const totalPrice = dailyRevenue * durationDays;
  
  return {
    totalPlaysPerDay,
    dailyRevenue,
    totalPrice
  };
};

// Format currency
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP'
  }).format(amount);
};

// Get status badge classes
export const getStatusBadgeClasses = (status: string): string => {
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

// Get status icon
export const getStatusIcon = (status: string) => {
  switch (status) {
    case 'RUNNING':
      return 'Play';
    case 'PENDING':
      return 'Clock';
    case 'ENDED':
      return 'Square';
    default:
      return 'Clock';
  }
};

// Get vehicle icon
export const getVehicleIcon = (vehicleType: string) => {
  return vehicleType === 'CAR' ? 'Car' : 'Bike';
};

// Get material icon
export const getMaterialIcon = (materialType: string) => {
  return materialType === 'LCD' ? 'Monitor' : 'Crown';
};

// Filter plans by active tab
export const filterPlansByTab = (plans: Plan[], activeTab: ActiveTab): Plan[] => {
  return plans.filter(plan => {
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
};

// Re-export Plan type for convenience
export type { Plan };
