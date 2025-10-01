import { gql } from '@apollo/client';

export const GET_SMART_MATERIAL_SELECTION = gql`
  query GetSmartMaterialSelection($materialType: String!, $vehicleType: String!, $category: String!, $timestamp: String) {
    getSmartMaterialSelection(
      materialType: $materialType
      vehicleType: $vehicleType
      category: $category
      timestamp: $timestamp
    ) {
      id
      materialId
      materialType
      vehicleType
      category
      occupiedSlots
      availableSlots
      totalSlots
      priority
    }
  }
`;
