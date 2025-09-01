import { gql } from '@apollo/client';

export const GET_ALL_ADMINS = gql`
  query {
    getAllAdmins {
      success
      message
      totalCount
      admins {
        id
        firstName
        middleName
        lastName
        email
        role
        isEmailVerified
        companyName
        companyAddress
        contactNumber
        profilePicture
        createdAt
      }
    }
  }
`;
