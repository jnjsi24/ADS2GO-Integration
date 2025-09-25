import { gql } from '@apollo/client';

export const CREATE_MATERIAL = gql`
  mutation CreateMaterial($input: CreateMaterialInput!) {
    createMaterial(input: $input) {
      id
      materialId
      vehicleType
      materialType
      description
      requirements
      category
      driverId
      mountedAt
      dismountedAt
      createdAt
      updatedAt
    }
  }
`;

export const DELETE_MATERIAL = gql`
  mutation DeleteMaterial($id: ID!) {
    deleteMaterial(id: $id)
  }
`;

export const ASSIGN_MATERIAL_TO_DRIVER = gql`
  mutation AssignMaterialToDriver($driverId: String!, $materialId: ID) {
    assignMaterialToDriver(driverId: $driverId, materialId: $materialId) {
      success
      message
      material {
        id
        materialId
        vehicleType
        materialType
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
      }
      driver {
        driverId
        fullName
        email
        contactNumber
        vehiclePlateNumber
      }
    }
  }
`;

export const UPDATE_MATERIAL = gql`
  mutation UpdateMaterial($id: ID!, $input: UpdateMaterialInput!) {
    updateMaterial(id: $id, input: $input) {
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

export const UNREGISTER_TABLET = gql`
  mutation UnregisterTablet($input: UnregisterTabletInput!) {
    unregisterTablet(input: $input) {
      success
      message
    }
  }
`;

export const CREATE_TABLET_CONFIGURATION = gql`
  mutation CreateTabletConfiguration($input: CreateTabletConfigurationInput!) {
    createTabletConfiguration(input: $input) {
      success
      message
      tablet {
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
  }
`;
