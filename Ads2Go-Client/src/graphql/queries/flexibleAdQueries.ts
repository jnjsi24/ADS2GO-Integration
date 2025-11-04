import { gql } from '@apollo/client';

export const GET_FLEXIBLE_FIELD_COMBINATIONS = gql`
  query GetFlexibleFieldCombinations {
    getFlexibleFieldCombinations {
      id
      materialType
      vehicleType
      category
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
      durationMonths
      adLengthSeconds
      numberOfDevices
      basePrice
      adLengthMultiplier
      durationDiscountMultiplier
      subtotal
      discount
      totalPrice
      availableDevices
      devicesWithDriver
      devicesMounted
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
  minAdLengthSeconds: number;
  maxAdLengthSeconds: number;
  isActive: boolean;
}

export interface FlexiblePricingCalculation {
  materialType: string;
  vehicleType: string;
  category: string;
  durationDays: number;
  durationMonths: number;
  adLengthSeconds: number;
  numberOfDevices: number;
  basePrice: number;
  adLengthMultiplier: number;
  durationDiscountMultiplier: number;
  subtotal: number;
  discount: number;
  totalPrice: number;
  availableDevices: number;
  devicesWithDriver: number;
  devicesMounted: number;
  minAdLengthSeconds: number;
  maxAdLengthSeconds: number;
}

export interface GetFlexibleFieldCombinationsResponse {
  getFlexibleFieldCombinations: FieldCombination[];
}

export interface CalculateFlexiblePricingResponse {
  calculateFlexiblePricing: FlexiblePricingCalculation;
}
