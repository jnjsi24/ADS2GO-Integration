import { gql } from '@apollo/client';

export const CREATE_AD = gql`
  mutation CreateAd($input: CreateAdInput!) {
    createAd(input: $input) {
      _id
      title
      description
      vehicleType
      materialsUsed
      adFormat
      mediaFile 
      plan
      price
      status
      startTime
      createdAt
      updatedAt
    }
  }
`;
