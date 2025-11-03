import { gql } from '@apollo/client';

export const UPDATE_AD = gql`
  mutation UpdateAd($id: ID!, $input: UpdateAdInput!) {
    updateAd(id: $id, input: $input) {
      id
      title
      description
      adFormat
      mediaFile
      adType
      vehicleType
      price
      status
      paymentStatus
      reasonForReject
      createdAt
      updatedAt
      startTime
      endTime
      adLengthSeconds
      durationDays
      materialType
      category
      materialId {
        id
        materialId
        materialType
        category
        description
        mountedAt
        dismountedAt
      }
    }
  }
`;

