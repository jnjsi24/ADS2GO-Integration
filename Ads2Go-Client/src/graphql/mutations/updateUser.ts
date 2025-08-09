import { gql } from '@apollo/client';

export const UPDATE_USER = gql`
  mutation UpdateUser($input: UpdateUserInput!) {
    updateUser(input: $input) {
      success
      message
      user {
        id
        firstName
        lastName
        email
        role
        isEmailVerified
        companyName
        companyAddress
        houseAddress
        contactNumber
        profilePicture
        createdAt
      }
    }
  }
`;

export interface UpdateUserInput {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: 'USER' | 'ADMIN' | 'SUPERADMIN';
  companyName?: string;
  companyAddress?: string;
  houseAddress?: string;
  contactNumber?: string;
  profilePicture?: string;
}

export interface UpdateUserResponse {
  updateUser: {
    success: boolean;
    message: string;
    user: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      role: 'USER' | 'ADMIN' | 'SUPERADMIN';
      isEmailVerified: boolean;
      companyName?: string;
      companyAddress?: string;
      houseAddress?: string;
      contactNumber?: string;
      profilePicture?: string;
      createdAt: string;
    };
  };
}
