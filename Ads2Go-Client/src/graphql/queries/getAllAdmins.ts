// src/graphql/queries/getAllAdmins.ts
import { gql } from '@apollo/client';

export const GET_ALL_ADMINS = gql`
  query GetAllAdmins {
    getAllAdmins {
      id
      firstName
      lastName
      email
      role
      isEmailVerified
      companyName
      companyAddress
      contactNumber
      createdAt
    }
  }
`;
