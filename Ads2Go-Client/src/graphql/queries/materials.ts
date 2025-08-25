import { gql } from '@apollo/client';

export const GET_MATERIALS = gql`
  query GetMaterials {
    getAllMaterials {
      id
      materialId
      materialType
      vehicleType
      category
      description
      price
      status
      createdAt
      updatedAt
    }
  }
`;

export const GET_MATERIALS_BY_CATEGORY_AND_VEHICLE = gql`
  query GetMaterialsByCategoryAndVehicle($category: MaterialCategory!, $vehicleType: VehicleType!) {
    getMaterialsByCategoryAndVehicle(category: $category, vehicleType: $vehicleType) {
      id
      materialId
      materialType
      vehicleType
      category
      description
      requirements
      driverId
      mountedAt
      dismountedAt
      createdAt
    }
  }
`;
