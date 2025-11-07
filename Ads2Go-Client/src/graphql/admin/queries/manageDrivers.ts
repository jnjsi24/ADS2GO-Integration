import { gql } from '@apollo/client';

export const GET_ALL_DRIVERS = gql`
  query GetAllDrivers($includeArchived: Boolean) {
    getAllDrivers(includeArchived: $includeArchived) {
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
      approvedBy {
        id
        firstName
        lastName
        email
      }
      rejectedBy {
        id
        firstName
        lastName
        email
      }
      deletedBy {
        id
        firstName
        lastName
        email
      }
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
