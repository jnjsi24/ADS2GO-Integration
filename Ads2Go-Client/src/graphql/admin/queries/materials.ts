import { gql } from '@apollo/client';

export const GET_ALL_MATERIALS = gql`
  query GetAllMaterials {
    getAllMaterials {
      id
      materialId
      vehicleType
      materialType
      description
      requirements
      category
      driverId
      driver {
        driverId
        fullName
        email
        contactNumber
        vehiclePlateNumber
      }
      mountedAt
      dismountedAt
      createdAt
      updatedAt
    }
  }
`;

export const GET_TABLETS_BY_MATERIAL = gql`
  query GetTabletsByMaterial($materialId: String!) {
    getTabletsByMaterial(materialId: $materialId) {
      id
      materialId
      carGroupId
      tablets {
        tabletNumber
        deviceId
        status
        gps {
          lat
          lng
        }
        lastSeen
      }
      createdAt
      updatedAt
    }
  }
`;

export const GET_TABLET_CONNECTION_STATUS = gql`
  query GetTabletConnectionStatus($materialId: String!, $slotNumber: Int!) {
    getTabletConnectionStatus(materialId: $materialId, slotNumber: $slotNumber) {
      isConnected
      connectedDevice {
        deviceId
        status
        lastSeen
        gps {
          lat
          lng
        }
      }
      materialId
      slotNumber
      carGroupId
    }
  }
`;

export const GET_DRIVERS_FOR_MATERIALS = gql`
  query GetDriversForMaterials {
    getAllDrivers {
      driverId
      fullName
      email
      contactNumber
      vehiclePlateNumber
      vehicleType
      preferredMaterialType
    }
  }
`;

export const GET_MATERIALS_BY_CATEGORY_AND_VEHICLE = gql`
  query GetMaterialsByCategoryAndVehicle($category: String!, $vehicleType: String!) {
    getMaterialsByCategoryAndVehicle(category: $category, vehicleType: $vehicleType) {
      id
      materialId
      vehicleType
      materialType
      description
      requirements
      category
      driverId
      driver {
        driverId
        fullName
        email
        contactNumber
        vehiclePlateNumber
      }
      mountedAt
      dismountedAt
      createdAt
      updatedAt
    }
  }
`;
