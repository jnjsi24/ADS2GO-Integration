import { gql } from '@apollo/client';

export const GET_OWN_ADMIN_DETAILS = gql`
  query GetOwnAdminDetails {
    getOwnAdminDetails {
      id
      firstName
      middleName
      lastName
      email
      role
      isEmailVerified
      isActive
      companyName
      companyAddress
      contactNumber
      lastLogin
      createdAt
      updatedAt
      permissions {
        userManagement
        adManagement
        driverManagement
        tabletManagement
        paymentManagement
        reports
      }
    }
  }
`;
