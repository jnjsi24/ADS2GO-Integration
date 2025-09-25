import { gql } from '@apollo/client';

export const GET_PLAN_AVAILABILITY = gql`
  query GetPlanAvailability($planId: ID!, $desiredStartDate: String!) {
    getPlanAvailability(planId: $planId, desiredStartDate: $desiredStartDate) {
      canCreate
      plan {
        id
        name
        description
        durationDays
        materialType
        vehicleType
        numberOfDevices
        adLengthSeconds
        pricePerPlay
        totalPrice
        materials {
          id
          materialId
          materialType
          vehicleType
          category
        }
      }
      materialAvailabilities {
        materialId
        materialInfo {
          id
          materialId
          materialType
          vehicleType
          category
        }
        totalSlots
        occupiedSlots
        availableSlots
        nextAvailableDate
        allSlotsFreeDate
        status
        canAcceptAd
      }
      totalAvailableSlots
      availableMaterialsCount
      nextAvailableDate
    }
  }
`;

export const GET_MATERIALS_AVAILABILITY = gql`
  query GetMaterialsAvailability($materialIds: [ID!]!) {
    getMaterialsAvailability(materialIds: $materialIds) {
      materialId
      materialInfo {
        id
        materialId
        materialType
        vehicleType
        category
      }
      totalSlots
      occupiedSlots
      availableSlots
      nextAvailableDate
      allSlotsFreeDate
      status
      canAcceptAd
    }
  }
`;

export const GET_AVAILABILITY_SUMMARY = gql`
  query GetAvailabilitySummary {
    getAvailabilitySummary
  }
`;

export interface MaterialAvailability {
  materialId: string;
  materialInfo: {
    id: string;
    materialId: string;
    materialType: string;
    vehicleType: string;
    category: string;
  };
  totalSlots: number;
  occupiedSlots: number;
  availableSlots: number;
  nextAvailableDate?: string;
  allSlotsFreeDate?: string;
  status: string;
  canAcceptAd: boolean;
}

export interface PlanAvailability {
  canCreate: boolean;
  plan: {
    id: string;
    name: string;
    description: string;
    durationDays: number;
    materialType: string;
    vehicleType: string;
    numberOfDevices: number;
    adLengthSeconds: number;
    pricePerPlay: number;
    totalPrice: number;
    materials: Array<{
      id: string;
      materialId: string;
      materialType: string;
      vehicleType: string;
      category: string;
    }>;
  };
  materialAvailabilities: MaterialAvailability[];
  totalAvailableSlots: number;
  availableMaterialsCount: number;
  nextAvailableDate?: string;
}

export interface AvailabilitySummary {
  totalMaterials: number;
  totalSlots: number;
  occupiedSlots: number;
  availableSlots: number;
  utilizationRate: number;
  materialsByStatus: {
    available: number;
    full: number;
    maintenance: number;
  };
}
