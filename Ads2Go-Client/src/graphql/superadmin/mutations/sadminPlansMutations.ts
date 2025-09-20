import { gql } from '@apollo/client';

/**
 * GraphQL Mutations for SadminPlans Component
 * This file contains all mutations used in the SadminPlans dashboard
 */

// Create Ads Plan mutation
export const CREATE_ADS_PLAN = gql`
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

// Update Ads Plan mutation
export const UPDATE_ADS_PLAN = gql`
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

// Delete Ads Plan mutation
export const DELETE_ADS_PLAN = gql`
  mutation DeleteAdsPlan($id: ID!) {
    deleteAdsPlan(id: $id)
  }
`;

// Start Ads Plan mutation
export const START_ADS_PLAN = gql`
  mutation StartAdsPlan($id: ID!) {
    startAdsPlan(id: $id) {
      id
      status
      startDate
    }
  }
`;

// End Ads Plan mutation
export const END_ADS_PLAN = gql`
  mutation EndAdsPlan($id: ID!) {
    endAdsPlan(id: $id) {
      id
      status
      endDate
    }
  }
`;

// Type definitions for the mutations
export interface AdsPlanInput {
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
}

export interface AdsPlanUpdateInput {
  name?: string;
  description?: string;
  durationDays?: number;
  category?: 'DIGITAL' | 'NON-DIGITAL';
  materialType?: string;
  vehicleType?: 'CAR' | 'MOTORCYCLE';
  numberOfDevices?: number;
  adLengthSeconds?: number;
  playsPerDayPerDevice?: number;
  totalPlaysPerDay?: number;
  pricePerPlay?: number;
  dailyRevenue?: number;
  totalPrice?: number;
}

export interface Plan {
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
  status: 'PENDING' | 'RUNNING' | 'ENDED' | 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
  startDate?: string;
  endDate?: string;
  currentDurationDays?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAdsPlanResponse {
  createAdsPlan: Plan;
}

export interface UpdateAdsPlanResponse {
  updateAdsPlan: Plan;
}

export interface DeleteAdsPlanResponse {
  deleteAdsPlan: boolean;
}

export interface StartAdsPlanResponse {
  startAdsPlan: {
    id: string;
    status: string;
    startDate: string;
  };
}

export interface EndAdsPlanResponse {
  endAdsPlan: {
    id: string;
    status: string;
    endDate: string;
  };
}
