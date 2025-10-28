import { gql } from 'graphql-request';

export const GET_DRIVER_REPORTS = gql`
  query GetDriverReports($filters: DriverReportFiltersInput, $limit: Int, $offset: Int) {
    getDriverReports(filters: $filters, limit: $limit, offset: $offset) {
      success
      message
      reports {
        id
        driverId
        title
        description
        reportType
        status
        attachments
        adminNotes
        adminNotesUpdatedAt
        adminNotesBy {
          adminId
          adminName
          adminEmail
        }
        createdAt
        updatedAt
        resolvedAt
      }
      totalCount
    }
  }
`;

export const GET_DRIVER_REPORT_BY_ID = gql`
  query GetDriverReportById($id: ID!) {
    getDriverReportById(id: $id) {
      id
      driverId
      title
      description
      reportType
      status
      attachments
      adminNotes
      adminNotesUpdatedAt
      adminNotesBy {
        adminId
        adminName
        adminEmail
      }
      createdAt
      updatedAt
      resolvedAt
    }
  }
`;

