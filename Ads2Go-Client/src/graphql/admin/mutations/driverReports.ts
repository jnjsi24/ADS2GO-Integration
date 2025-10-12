import { gql } from '@apollo/client';

export const UPDATE_DRIVER_REPORT_ADMIN = gql`
  mutation UpdateDriverReportAdmin($id: ID!, $input: AdminUpdateDriverReportInput!) {
    updateDriverReportAdmin(id: $id, input: $input) {
      success
      message
      report {
        id
        driverId
        title
        description
        reportType
        status
        attachments
        adminNotes
        createdAt
        updatedAt
        resolvedAt
      }
    }
  }
`;

