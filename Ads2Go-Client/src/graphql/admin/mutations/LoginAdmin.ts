import { gql } from '@apollo/client';

export const LOGIN_ADMIN_MUTATION = gql`
  mutation LoginAdmin($email: String!, $password: String!, $deviceInfo: DeviceInfoInput!) {
    loginAdmin(email: $email, password: $password, deviceInfo: $deviceInfo) {
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
