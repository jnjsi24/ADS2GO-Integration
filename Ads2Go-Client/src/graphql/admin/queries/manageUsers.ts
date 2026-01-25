import { gql } from '@apollo/client';

export const GET_ALL_USERS = gql`
  query GetAllUsers($includeArchived: Boolean) {
    getAllUsers(includeArchived: $includeArchived) {
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
        status
        isArchived
      }
      isArchived
      archivedAt
      scheduledDeletionDate
    }
  }
`;
