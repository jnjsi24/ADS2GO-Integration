import { gql } from '@apollo/client';

export const CREATE_ADMIN = gql`
  mutation CreateAdmin($input: CreateAdminInput!) {
    createAdmin(input: $input) {
      success
      message
      admin {
        id
        firstName
        middleName
        lastName
        email
        role
        isEmailVerified
        companyName
        companyAddress
        contactNumber
        profilePicture
        createdAt
      }
    }
  }
`;

export interface CreateAdminResponse {
  createAdmin: {
    success: boolean;
    message: string;
    admin: {
      id: string;
      firstName: string;
      middleName?: string;
      lastName: string;
      email: string;
      role: string;
      isEmailVerified: boolean;
      companyName: string;
      companyAddress: string;
      contactNumber: string;
      profilePicture?: string;
      createdAt: string;
    };
  };
}
