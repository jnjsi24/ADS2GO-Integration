import { gql } from '@apollo/client';

export const GET_MATERIALS = gql`
  query GetMaterials($vehicleType: VehicleType!, $category: MaterialCategory!) {
    getMaterials(vehicleType: $vehicleType, category: $category) {
      materialId
      vehicleType
      materialType
      description
      category
      driverId
      mountedAt
      dismountedAt
    }
  }
`;
