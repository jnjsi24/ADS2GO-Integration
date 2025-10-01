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
  query GetMaterialsByCategoryAndVehicle($category: MaterialCategory!, $vehicleType: VehicleType!) {
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

export const GET_MATERIALS_BY_CATEGORY_VEHICLE_AND_TYPE = gql`
  query GetMaterialsByCategoryVehicleAndType($category: MaterialCategory!, $vehicleType: VehicleType!, $materialType: MaterialTypeEnum!) {
    getMaterialsByCategoryVehicleAndType(category: $category, vehicleType: $vehicleType, materialType: $materialType) {
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

export const GET_MATERIAL_USAGE_HISTORY = gql`
  query GetMaterialUsageHistory($materialId: ID!) {
    getMaterialUsageHistory(materialId: $materialId) {
      success
      message
      usageHistory {
        id
        materialId
        driverId
        driverInfo {
          driverId
          fullName
          email
          contactNumber
          vehiclePlateNumber
        }
        assignedAt
        unassignedAt
        mountedAt
        dismountedAt
        usageDuration
        assignmentReason
        unassignmentReason
        customDismountReason
        assignedByAdmin {
          adminId
          adminName
          adminEmail
        }
        unassignedByAdmin {
          adminId
          adminName
          adminEmail
        }
        notes
        isActive
        createdAt
        updatedAt
      }
    }
  }
`;
