// src/graphql/mutations/Login.ts
import { gql } from '@apollo/client';

export const LOGIN_MUTATION = gql`
  mutation Login($email: String!, $password: String!, $deviceInfo: DeviceInfoInput!) {
    login(email: $email, password: $password, deviceInfo: $deviceInfo) {
      token
      user {
        id                    # ✅ correct
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
