import { gql } from '@apollo/client';

export const GET_OWN_USER_DETAILS = gql`
  query GetOwnUserDetails {
    getOwnUserDetails {
      id
      firstName
      middleName
      lastName
      email
      role
      isEmailVerified
      contactNumber
      companyName
      companyAddress
      houseAddress
      profilePicture
      createdAt
      updatedAt
    }
  }
`;
