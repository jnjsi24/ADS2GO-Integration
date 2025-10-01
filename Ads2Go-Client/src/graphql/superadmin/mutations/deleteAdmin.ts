import { gql } from '@apollo/client';

export const DELETE_ADMIN = gql`
  mutation DeleteAdmin($id: ID!) {
    deleteAdmin(id: $id) {
      success
      message
      admin {
        id
        firstName
        lastName
        email
      }
    }
  }
`;

export interface DeleteAdminResponse {
  deleteAdmin: {
    success: boolean;
    message: string;
    admin: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    };
  };
}
