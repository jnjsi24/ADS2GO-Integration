import { gql } from '@apollo/client';

export const GET_ALL_ADMINS = gql`
  query {
    getAllAdmins {
      id
      firstName
      middleName
      lastName
      email
      role
      isEmailVerified
      companyName
      companyAddress
      houseAddress
      contactNumber
      profilePicture
      createdAt
    }
  }
`;
