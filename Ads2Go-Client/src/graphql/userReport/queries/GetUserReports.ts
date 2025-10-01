import { gql } from '@apollo/client';

export const GET_USER_REPORTS = gql`
  query GetUserReports($filters: UserReportFiltersInput, $limit: Int, $offset: Int) {
    getUserReports(filters: $filters, limit: $limit, offset: $offset) {
      success
      message
      reports {
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
      }
      totalCount
    }
  }
`;

export const GET_USER_REPORT_BY_ID = gql`
  query GetUserReportById($id: ID!) {
    getUserReportById(id: $id) {
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
    }
  }
`;
