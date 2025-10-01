import { gql } from '@apollo/client';

export const LOGIN_ADMIN_MUTATION = gql`
  mutation LoginAdmin($email: String!, $password: String!, $deviceInfo: DeviceInfoInput!) {
    loginAdmin(email: $email, password: $password, deviceInfo: $deviceInfo) {
      token
      admin {
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
  }
`;
