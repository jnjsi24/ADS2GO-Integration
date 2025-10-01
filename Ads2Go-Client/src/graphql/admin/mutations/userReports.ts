import { gql } from '@apollo/client';

export const UPDATE_USER_REPORT_ADMIN = gql`
  mutation UpdateUserReportAdmin($id: ID!, $input: AdminUpdateUserReportInput!) {
    updateUserReportAdmin(id: $id, input: $input) {
      success
      message
      report {
        id
        title
        description
        reportType
        status
        attachments
        adminNotes
        createdAt
        updatedAt
        resolvedAt
        user {
          id
          firstName
          lastName
          email
        }
      }
    }
  }
`;
