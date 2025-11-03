import { gql } from '@apollo/client';

export const GET_ALL_PRICING_CONFIGS = gql`
  query GetAllPricingConfigs {
    getAllPricingConfigs {
      id
      materialType
      vehicleType
      category
      basePrice
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
      basePrice
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
    $durationMonths: Int!
    $adLengthSeconds: Int!
    $numberOfVehicles: Int!
  ) {
    calculatePricingConfig(
      materialType: $materialType
      vehicleType: $vehicleType
      category: $category
      durationMonths: $durationMonths
      adLengthSeconds: $adLengthSeconds
      numberOfVehicles: $numberOfVehicles
    ) {
      materialType
      vehicleType
      category
      basePrice
      durationMonths
      adLengthSeconds
      numberOfVehicles
      adLengthMultiplier
      durationDiscountMultiplier
      subtotal
      discount
      totalPrice
      minAdLengthSeconds
      maxAdLengthSeconds
    }
  }
`;

// Removed PricingTier - no longer using pricing tiers

export interface PricingConfig {
  id: string;
  materialType: string;
  vehicleType: string;
  category: string;
  basePrice: number;
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
  basePrice: number;
  durationMonths: number;
  adLengthSeconds: number;
  numberOfVehicles: number;
  adLengthMultiplier: number;
  durationDiscountMultiplier: number;
  subtotal: number;
  discount: number;
  totalPrice: number;
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

