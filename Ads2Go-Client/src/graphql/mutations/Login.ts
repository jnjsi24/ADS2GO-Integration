// src/graphql/mutations/Login.ts
import { gql } from '@apollo/client';

export const LOGIN_MUTATION = gql`
  mutation LoginUser($email: String!, $password: String!, $deviceInfo: DeviceInfoInput!) {
    loginUser(email: $email, password: $password, deviceInfo: $deviceInfo) {
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
