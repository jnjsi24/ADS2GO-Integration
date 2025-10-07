import { gql } from "@apollo/client";

export const UPDATE_SUPER_ADMIN_DETAIL = gql`
  mutation UpdateSuperAdminDetail($superAdminId: ID!, $input: UpdateSuperAdminInput!) {
    updateSuperAdmin(superAdminId: $superAdminId, input: $input) {
      success
      message
      superAdmin {
        id
        firstName
        middleName
        lastName
        email
        contactNumber
        companyName
        companyAddress
        profilePicture
      }
    }
  }
`;
