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
      vehicleType
      price
      status
      reasonForReject
      createdAt
      startTime
      endTime
      adLengthSeconds
      materialId {
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
