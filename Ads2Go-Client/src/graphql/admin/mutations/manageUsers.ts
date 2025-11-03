import { gql } from '@apollo/client';

export const DELETE_USER = gql`
  mutation DeleteUser($id: ID!) {
    deleteUser(id: $id) {
      success
      message
    }
  }
`;

export const RESTORE_USER = gql`
  mutation RestoreUser($id: ID!) {
    restoreUser(id: $id) {
      success
      message
    }
  }
`;
