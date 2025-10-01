import { gql } from '@apollo/client';

export const CREATE_ADMIN_USER = gql`
  mutation CreateAdminUser($input: CreateAdminInput!) {
    createAdminUser(input: $input) {
      success
      message
      user {
        id
        firstName
        middleName
        lastName
        email
        role
        companyName
        companyAddress
        contactNumber
        createdAt
      }
    }
  }
`;
