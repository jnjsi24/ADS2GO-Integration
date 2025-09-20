import { Plan } from '../../../../graphql/superadmin/queries/sadminPlansQueries';

// Form data interfaces
export interface PlanFormData {
  planName: string;
  planDescription: string;
  durationDays: number;
  category: 'DIGITAL' | 'NON-DIGITAL' | '';
  materialType: string;
  vehicleType: 'CAR' | 'MOTORCYCLE' | '';
  numberOfDevices: number;
  adLengthSeconds: number;
  playsPerDayPerDevice: number;
  pricePerPlayOverride: number | '';
  deviceCostOverride: number | '';
  durationCostOverride: number | '';
  adLengthCostOverride: number | '';
}

// Tab types
export type ActiveTab = 'running' | 'pending' | 'ended';

// Material type options
export interface MaterialOption {
  value: string;
  label: string;
}

// Re-export Plan type for convenience
export type { Plan };
