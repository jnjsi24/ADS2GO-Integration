import { gql } from '@apollo/client';

export const GET_ALL_PRICING_CONFIGS = gql`
  query GetAllPricingConfigs {
    getAllPricingConfigs {
      id
      materialType
      vehicleType
      category
      pricingTiers {
        durationDays
        pricePerPlay
        adLengthMultiplier
      }
      maxDevices
      minAdLengthSeconds
      maxAdLengthSeconds
      isActive
      createdBy
      createdAt
      updatedAt
    }
  }
`;

export const GET_PRICING_CONFIG = gql`
  query GetPricingConfig($materialType: String!, $vehicleType: String!, $category: String!) {
    getPricingConfig(materialType: $materialType, vehicleType: $vehicleType, category: $category) {
      id
      materialType
      vehicleType
      category
      pricingTiers {
        durationDays
        pricePerPlay
        adLengthMultiplier
      }
      maxDevices
      minAdLengthSeconds
      maxAdLengthSeconds
      isActive
    }
  }
`;

// Note: getAvailableFieldCombinations is now available in flexibleAdQueries.ts

export const CALCULATE_PRICING_CONFIG = gql`
  query CalculatePricingConfig(
    $materialType: String!
    $vehicleType: String!
    $category: String!
    $durationDays: Int!
    $adLengthSeconds: Int!
    $numberOfDevices: Int!
  ) {
    calculatePricingConfig(
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
      minAdLengthSeconds
      maxAdLengthSeconds
    }
  }
`;

export interface PricingTier {
  durationDays: number;
  pricePerPlay: number;
  adLengthMultiplier?: number;
}

export interface PricingConfig {
  id: string;
  materialType: string;
  vehicleType: string;
  category: string;
  pricingTiers: PricingTier[];
  maxDevices: number;
  minAdLengthSeconds: number;
  maxAdLengthSeconds: number;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface PricingCalculation {
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
  minAdLengthSeconds: number;
  maxAdLengthSeconds: number;
}

export interface GetAllPricingConfigsResponse {
  getAllPricingConfigs: PricingConfig[];
}

export interface GetPricingConfigResponse {
  getPricingConfig: PricingConfig;
}

// Note: GetAvailableFieldCombinationsResponse is now available in flexibleAdQueries.ts

export interface CalculatePricingConfigResponse {
  calculatePricingConfig: PricingCalculation;
}

