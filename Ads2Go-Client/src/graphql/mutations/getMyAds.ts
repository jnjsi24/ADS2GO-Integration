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
      createdAt
      price
      planId       # ✅ no subfields
      materialId   # ✅ no subfields
    }
  }
`;
