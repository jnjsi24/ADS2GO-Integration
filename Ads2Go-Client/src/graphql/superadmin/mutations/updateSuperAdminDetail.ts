import { gql } from "@apollo/client";

export const UPDATE_SUPER_ADMIN_DETAIL = gql`
  mutation UpdateSuperAdminDetail($adminId: ID!, $input: UpdateAdminDetailsInput!) {
    updateAdminDetails(adminId: $adminId, input: $input) {
      success
      message
      user {
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
