import { gql } from '@apollo/client';

export const GET_ALL_USERS = gql`
  query GetAllUsers {
    getAllUsers {
      id
      firstName
      middleName
      lastName
      email
      companyName
      companyAddress
      houseAddress
      contactNumber
      profilePicture
      role
      isEmailVerified
      lastLogin
      createdAt
      updatedAt
      ads {
        id
      }
    }
  }
`;
