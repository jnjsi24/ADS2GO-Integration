import { gql } from '@apollo/client';

export const DELETE_USER = gql`
  mutation DeleteUser($id: ID!) {
    deleteUser(id: $id) {
      success
      message
    }
  }
`;

export interface DeleteUserResponse {
  deleteUser: {
    success: boolean;
    message: string;
  };
}
