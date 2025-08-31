// src/graphql/mutations/updateAdminUser.ts
import { gql } from "@apollo/client";

export const UPDATE_ADMIN_USER = gql`
  mutation UpdateAdminDetails($adminId: ID!, $input: UpdateAdminDetailsInput!) {
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
      }
    }
  }
`;
