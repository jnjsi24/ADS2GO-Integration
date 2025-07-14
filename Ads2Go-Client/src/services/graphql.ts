import { gql } from '@apollo/client';

// ✅ Authentication Mutations
export const LOGIN_MUTATION = gql`
  mutation Login($email: String!, $password: String!, $deviceInfo: DeviceInfoInput!) {
    login(email: $email, password: $password, deviceInfo: $deviceInfo) {
      token
      user {
        id
        name
        email
        isEmailVerified
      }
    }
  }
`;

export const REGISTER_MUTATION = gql`
  mutation CreateUser($input: CreateUserInput!) {
    createUser(input: $input) {
      token
      user {
        id
        name
        email
        isEmailVerified
      }
    }
  }
`;

export const VERIFY_EMAIL_MUTATION = gql`
  mutation VerifyEmail($code: String!) {
    verifyEmail(code: $code) {
      success
      message
    }
  }
`;

export const RESEND_VERIFICATION_CODE_MUTATION = gql`
  mutation ResendVerificationCode($email: String!) {
    resendVerificationCode(email: $email) {
      success
      message
    }
  }
`;

// ✅ User Queries
export const GET_USER_PROFILE = gql`
  query GetUserProfile {
    me {
      id
      name
      email
      houseAddress
      contactNumber
      role
      isEmailVerified
    }
  }
`;

// ✅ Logout Mutation
export const LOGOUT_MUTATION = gql`
  mutation Logout {
    logout
  }
`;


// ✅ Admin Queries & Mutations
export const GET_ALL_USERS = gql`
  query GetAllUsers {
    getAllUsers {
      id
      name
      email
      houseAddress
      contactNumber
      role
      isEmailVerified
    }
  }
`;
export const UPDATE_USER = gql`
  mutation UpdateUser($id: ID!, $input: UpdateUserInput!) {
    updateUser(id: $id, input: $input) {
      id
      role
    }
  }
`;

export const DELETE_USER = gql`
  mutation DeleteUser($id: ID!) {
    deleteUser(id: $id) {
      success
      message
    }
  }
`;

export const CHANGE_PASSWORD = gql`
  mutation ChangePassword($id: ID!, $newPassword: String!) {
    changePassword(id: $id, newPassword: $newPassword) {
      success
      message
    }
  }
`;
