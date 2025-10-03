import { gql } from '@apollo/client';

export const CHANGE_SUPERADMIN_PASSWORD = gql`
  mutation ChangeSuperAdminPassword($currentPassword: String!, $newPassword: String!) {
    changeSuperAdminPassword(currentPassword: $currentPassword, newPassword: $newPassword)
  }
`;

export interface ChangeSuperAdminPasswordResponse {
  changeSuperAdminPassword: boolean;
}
