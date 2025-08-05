import { gql } from '@apollo/client';

export const GET_MY_ADS = gql`
  query GetMyAds {
    getMyAds {
      id
      title
      description
      vehicleType
      materialsUsed
      adFormat
      mediaFile
      plan
      price
      status
      createdAt
    }
  }
`;
