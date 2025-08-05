import { gql } from '@apollo/client';

export const GET_MY_ADS = gql`
  query GetMyAds {
    getMyAds {
      _id
      title
      adType
      createdAt
    }
  }
`;
