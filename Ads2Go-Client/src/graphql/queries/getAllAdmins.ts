import { gql } from '@apollo/client';

export const GET_ALL_ADMINS = gql`
  query {
    getAllAdmins {
      id
      firstName
      lastName
      email
      role
      companyName
      createdAt
    }
  }
`;
