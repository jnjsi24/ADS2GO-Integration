import { gql } from '@apollo/client';

export const UPDATE_SUPERADMIN = gql`
  mutation UpdateSuperAdmin($superAdminId: ID!, $input: UpdateSuperAdminInput!) {
    updateSuperAdmin(superAdminId: $superAdminId, input: $input) {
      success
      message
      superAdmin {
        id
        firstName
        middleName
        lastName
        email
        recoveryEmail
        profilePicture
        companyName
        companyAddress
        contactNumber
        isActive
        createdAt
        updatedAt
      }
    }
  }
`;

export interface UpdateSuperAdminResponse {
  updateSuperAdmin: {
    success: boolean;
    message: string;
    superAdmin: {
      id: string;
      firstName: string;
      middleName?: string;
      lastName: string;
      email: string;
      recoveryEmail?: string;
      profilePicture?: string;
      companyName: string;
      companyAddress: string;
      contactNumber: string;
      isActive: boolean;
      createdAt: string;
      updatedAt: string;
    };
  };
}
