import { gql } from '@apollo/client';

export const CREATE_AD = gql`
  mutation CreateAd($input: CreateAdInput!) {
    createAd(input: $input) {
      id
      title
      description
      website
      adType
      adFormat
      materialId {
        id
        materialType
        vehicleType
      }
      price
      totalPrice
      status
      mediaFile
      startTime
      endTime
      createdAt
      updatedAt
    }
  }
`;
