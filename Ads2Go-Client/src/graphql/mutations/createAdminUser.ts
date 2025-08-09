import { gql } from '@apollo/client';

// GraphQL Mutations (unchanged)
export const CREATE_ADMIN_USER = gql`
  mutation CreateAdminUser($input: CreateUserInput!) {
    createAdminUser(input: $input) {
      success
      message
      user {
        id
        firstName
        lastName
        email
        role
        createdAt
      }
    }
  }
`;