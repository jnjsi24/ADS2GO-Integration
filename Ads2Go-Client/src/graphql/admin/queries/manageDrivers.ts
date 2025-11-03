import { gql } from '@apollo/client';

export const GET_ALL_DRIVERS = gql`
  query GetAllDrivers {
    getAllDrivers {
      id
      driverId
      firstName
      middleName
      lastName
      email
      contactNumber
      vehicleType
      vehicleModel
      vehiclePlateNumber
      accountStatus
      reviewStatus
      installedMaterialType
      address
      licenseNumber
      licensePictureURL
      orCrPictureURL
      licenseFrontURL
      licenseBackURL
      orPictureURL
      crPictureURL
      vehiclePhotoURL
      profilePicture
      dateJoined
      approvalDate
      rejectedReason
      createdAt
      lastLogin
      material {
        materialId
        materialType
        category
        description
      }
      isArchived
      archivedAt
      scheduledDeletionDate
    }
  }
`;

export const GET_DRIVER_USAGE_HISTORY = gql`
  query GetDriverUsageHistory($driverId: ID!) {
    getDriverUsageHistory(driverId: $driverId) {
      success
      message
      usageHistory {
        id
        materialId
        materialStringId
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
        assignedByAdmin { adminId adminName adminEmail }
        unassignedByAdmin { adminId adminName adminEmail }
        notes
        isActive
        createdAt
        updatedAt
      }
    }
  }
`;
