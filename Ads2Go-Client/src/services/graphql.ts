import { gql } from '@apollo/client';

// ✅ Authentication Mutations
export const LOGIN_MUTATION = gql`
  mutation Login($email: String!, $password: String!, $deviceInfo: DeviceInfoInput!) {
    login(email: $email, password: $password, deviceInfo: $deviceInfo) {
      token
      user {
        id
        firstName
        lastName
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
        firstName
        lastName
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
      firstName
      lastName
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
      firstName
      lastName
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

// ✅ Screen Control Mutations
export const PAUSE_ALL_SCREENS = gql`
  mutation PauseAllScreens {
    pauseAllScreens {
      success
      message
      pausedCount
    }
  }
`;

export const PLAY_ALL_SCREENS = gql`
  mutation PlayAllScreens {
    playAllScreens {
      success
      message
    }
  }
`;

export const SYNC_ALL_SCREENS = gql`
  mutation SyncAllScreens {
    syncAllScreens {
      success
      message
    }
  }
`;

export const STOP_ALL_SCREENS = gql`
  mutation StopAllScreens {
    stopAllScreens {
      success
      message
    }
  }
`;

export const LOCKDOWN_ALL_SCREENS = gql`
  mutation LockdownAllScreens {
    lockdownAllScreens {
      success
      message
      pausedCount
    }
  }
`;

export const UNLOCK_ALL_SCREENS = gql`
  mutation UnlockAllScreens {
    unlockAllScreens {
      success
      message
      pausedCount
    }
  }
`;

export const FULLSCREEN_ALL_SCREENS = gql`
  mutation FullscreenAllScreens {
    fullscreenAllScreens {
      success
      message
      fullscreenCount
    }
  }
`;

export const EXIT_FULLSCREEN_ALL_SCREENS = gql`
  mutation ExitFullscreenAllScreens {
    exitFullscreenAllScreens {
      success
      message
      exitFullscreenCount
    }
  }
`;
