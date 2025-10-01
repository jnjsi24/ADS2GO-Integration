import { gql } from '@apollo/client';

/**
 * GraphQL Queries for SadminPlans Component
 * This file contains all queries used in the SadminPlans dashboard
 */

// Get all ads plans query
export const GET_ALL_ADS_PLANS = gql`
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

// Type definitions for the queries
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

export interface GetAllAdsPlansResponse {
  getAllAdsPlans: Plan[];
}
