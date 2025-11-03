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
        isArchived
        archivedAt
        scheduledDeletionDate
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

export const DELETE_USER_REPORT_ADMIN = gql`
  mutation DeleteUserReportAdmin($id: ID!) {
    deleteUserReportAdmin(id: $id) {
      success
      message
      report {
        id
        title
        description
        reportType
        status
        isArchived
        archivedAt
        scheduledDeletionDate
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

export const RESTORE_USER_REPORT = gql`
  mutation RestoreUserReport($id: ID!) {
    restoreUserReport(id: $id) {
      success
      message
      report {
        id
        title
        description
        reportType
        status
        isArchived
        archivedAt
        scheduledDeletionDate
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
