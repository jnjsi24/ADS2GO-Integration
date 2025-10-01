import { gql } from '@apollo/client';

export const DEACTIVATE_SUPERADMIN = gql`
  mutation DeactivateSuperAdmin($id: ID!) {
    deactivateSuperAdmin(id: $id) {
      success
      message
      superAdmin {
        id
        firstName
        lastName
        email
        isActive
      }
    }
  }
`;

export interface DeactivateSuperAdminResponse {
  deactivateSuperAdmin: {
    success: boolean;
    message: string;
    superAdmin: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      isActive: boolean;
    };
  };
}
