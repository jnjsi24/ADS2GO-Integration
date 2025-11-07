import { gql } from '@apollo/client';

export const GET_MY_ADS = gql`
  query GetMyAds {
    getMyAds {
      id
      title
      description
      adFormat
      mediaFile
      adType
      status
      paymentStatus
      vehicleType
      createdAt
      updatedAt
      price
      startTime
      endTime
      adLengthSeconds
      durationDays
      materialType
      category

      # Removed planId - no longer using AdsPlan

      materialId {   # populated Material object
        id
        materialId
        materialType
        category
        description
        mountedAt
        dismountedAt
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
      restoredBy {
        id
        firstName
        lastName
        email
      }
    }
  }
`;
