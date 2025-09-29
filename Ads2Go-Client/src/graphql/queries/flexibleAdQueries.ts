import { gql } from '@apollo/client';

export const GET_FLEXIBLE_FIELD_COMBINATIONS = gql`
  query GetFlexibleFieldCombinations {
    getFlexibleFieldCombinations {
      id
      materialType
      vehicleType
      category
      maxDevices
      minAdLengthSeconds
      maxAdLengthSeconds
      isActive
    }
  }
`;

export const CALCULATE_FLEXIBLE_PRICING = gql`
  query CalculateFlexiblePricing(
    $materialType: String!
    $vehicleType: String!
    $category: String!
    $durationDays: Int!
    $adLengthSeconds: Int!
    $numberOfDevices: Int!
  ) {
    calculateFlexiblePricing(
      materialType: $materialType
      vehicleType: $vehicleType
      category: $category
      durationDays: $durationDays
      adLengthSeconds: $adLengthSeconds
      numberOfDevices: $numberOfDevices
    ) {
      materialType
      vehicleType
      category
      durationDays
      adLengthSeconds
      numberOfDevices
      pricePerPlay
      playsPerDayPerDevice
      totalPlaysPerDay
      dailyRevenue
        totalPrice
        maxDevices
        availableDevices
        minAdLengthSeconds
        maxAdLengthSeconds
    }
  }
`;

export interface FieldCombination {
  id: string;
  materialType: string;
  vehicleType: string;
  category: string;
  maxDevices: number;
  minAdLengthSeconds: number;
  maxAdLengthSeconds: number;
  isActive: boolean;
}

export interface FlexiblePricingCalculation {
  materialType: string;
  vehicleType: string;
  category: string;
  durationDays: number;
  adLengthSeconds: number;
  numberOfDevices: number;
  pricePerPlay: number;
  playsPerDayPerDevice: number;
  totalPlaysPerDay: number;
  dailyRevenue: number;
  totalPrice: number;
  maxDevices: number;
  availableDevices: number;
  minAdLengthSeconds: number;
  maxAdLengthSeconds: number;
}

export interface GetFlexibleFieldCombinationsResponse {
  getFlexibleFieldCombinations: FieldCombination[];
}

export interface CalculateFlexiblePricingResponse {
  calculateFlexiblePricing: FlexiblePricingCalculation;
}
