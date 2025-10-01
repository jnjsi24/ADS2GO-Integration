import { gql } from '@apollo/client';

export const UPDATE_ADMIN = gql`
  mutation UpdateAdmin($adminId: ID!, $input: UpdateAdminInput!) {
    updateAdmin(adminId: $adminId, input: $input) {
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

export interface UpdateAdminResponse {
  updateAdmin: {
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
