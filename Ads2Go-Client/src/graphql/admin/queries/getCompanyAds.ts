import { gql } from '@apollo/client';

export const GET_COMPANY_ADS = gql`
  query GetAllCompanyAds {
    getAllCompanyAds {
      id
      title
      description
      mediaFile
      adFormat
      duration
      isActive
      priority
      createdBy {
        id
        firstName
        lastName
        email
      }
      updatedBy {
        id
        firstName
        lastName
        email
      }
      createdAt
      updatedAt
    }
  }
`;

export const GET_ACTIVE_COMPANY_ADS = gql`
  query GetActiveCompanyAds {
    getActiveCompanyAds {
      id
      title
      description
      mediaFile
      adFormat
      duration
      isActive
      priority
      createdAt
      updatedAt
    }
  }
`;
