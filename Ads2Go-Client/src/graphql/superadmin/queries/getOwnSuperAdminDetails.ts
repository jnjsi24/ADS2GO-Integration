import { gql } from '@apollo/client';

export const GET_OWN_SUPERADMIN_DETAILS = gql`
  query GetOwnSuperAdminDetails {
    getOwnSuperAdminDetails {
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
        adminManagement
        adManagement
        driverManagement
        tabletManagement
        paymentManagement
        reports
        systemSettings
        databaseManagement
        auditLogs
      }
    }
  }
`;
