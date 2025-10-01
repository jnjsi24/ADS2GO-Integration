import { gql } from '@apollo/client';

export const LOGIN_SUPERADMIN_MUTATION = gql`
  mutation LoginSuperAdmin($email: String!, $password: String!, $deviceInfo: DeviceInfoInput!) {
    loginSuperAdmin(email: $email, password: $password, deviceInfo: $deviceInfo) {
      token
      superAdmin {
        id
        email
        role
        isEmailVerified
        firstName
        middleName
        lastName
        companyName
        companyAddress
        contactNumber
        profilePicture
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
  }
`;
