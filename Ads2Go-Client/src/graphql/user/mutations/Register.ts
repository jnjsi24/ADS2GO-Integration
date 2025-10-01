import { gql } from '@apollo/client';

export const REGISTER_MUTATION = gql`
  mutation CreateUser($input: CreateUserInput!) {
    createUser(input: $input) {
      token
      user {
        id
        firstName
        lastName
        email
        isEmailVerified
      }
    }
  }
`;
