import { gql } from '@apollo/client';

export const CREATE_PRICING_CONFIG = gql`
  mutation CreatePricingConfig($input: PricingConfigInput!) {
    createPricingConfig(input: $input) {
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

export const UPDATE_PRICING_CONFIG = gql`
  mutation UpdatePricingConfig($id: ID!, $input: PricingConfigUpdateInput!) {
    updatePricingConfig(id: $id, input: $input) {
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

export const DELETE_PRICING_CONFIG = gql`
  mutation DeletePricingConfig($id: ID!) {
    deletePricingConfig(id: $id)
  }
`;

export const RESTORE_PRICING_CONFIG = gql`
  mutation RestorePricingConfig($id: ID!) {
    restorePricingConfig(id: $id)
  }
`;

export const TOGGLE_PRICING_CONFIG_STATUS = gql`
  mutation TogglePricingConfigStatus($id: ID!) {
    togglePricingConfigStatus(id: $id) {
      id
      isActive
    }
  }
`;

// Removed PricingTierInput - no longer using pricing tiers

export interface PricingConfigInput {
  materialType: string;
  vehicleType: string;
  category: string;
  basePrice: number;
  minAdLengthSeconds?: number;
  maxAdLengthSeconds?: number;
  isActive?: boolean;
}

export interface PricingConfigUpdateInput {
  basePrice?: number;
  minAdLengthSeconds?: number;
  maxAdLengthSeconds?: number;
  isActive?: boolean;
}

export interface CreatePricingConfigResponse {
  createPricingConfig: {
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
  };
}

export interface UpdatePricingConfigResponse {
  updatePricingConfig: {
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
  };
}

export interface DeletePricingConfigResponse {
  deletePricingConfig: string;
}

export interface TogglePricingConfigStatusResponse {
  togglePricingConfigStatus: {
    id: string;
    isActive: boolean;
  };
}

