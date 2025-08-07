import { gql } from '@apollo/client';

export const LOGIN_MUTATION = gql`
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      token
      user {
        id
        email
        role
        isEmailVerified
        firstName
        middleName
        lastName
        houseAddress
        companyName
        companyAddress
        contactNumber
        profilePicture
        createdAt
        updatedAt
      }
    }
  }
`;
