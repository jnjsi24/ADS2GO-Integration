import { gql } from '@apollo/client';

export const CREATE_COMPANY_AD = gql`
  mutation CreateCompanyAd($input: CreateCompanyAdInput!) {
    createCompanyAd(input: $input) {
      id
      title
      description
      mediaFile
      adFormat
      duration
      isActive
      priority
      playCount
      lastPlayed
      tags
      notes
      createdBy {
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

export const UPDATE_COMPANY_AD = gql`
  mutation UpdateCompanyAd($id: ID!, $input: UpdateCompanyAdInput!) {
    updateCompanyAd(id: $id, input: $input) {
      id
      title
      description
      mediaFile
      adFormat
      duration
      isActive
      priority
      playCount
      lastPlayed
      tags
      notes
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

export const DELETE_COMPANY_AD = gql`
  mutation DeleteCompanyAd($id: ID!) {
    deleteCompanyAd(id: $id)
  }
`;

export const TOGGLE_COMPANY_AD_STATUS = gql`
  mutation ToggleCompanyAdStatus($id: ID!) {
    toggleCompanyAdStatus(id: $id) {
      id
      title
      isActive
      updatedAt
    }
  }
`;
