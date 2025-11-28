import { gql } from '@apollo/client';

export const DELETE_USER = gql`
  mutation DeleteUser($id: ID!, $reason: String) {
    deleteUser(id: $id, reason: $reason) {
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
