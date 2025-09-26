import { gql } from '@apollo/client';

export const GET_ALL_USER_REPORTS = gql`
  query GetAllUserReports($filters: UserReportFiltersInput, $limit: Int, $offset: Int) {
    getAllUserReports(filters: $filters, limit: $limit, offset: $offset) {
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
        user {
          id
          firstName
          lastName
          email
        }
      }
      totalCount
    }
  }
`;

export const GET_USER_REPORT_BY_ID_ADMIN = gql`
  query GetUserReportByIdAdmin($id: ID!) {
    getUserReportByIdAdmin(id: $id) {
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
        companyName
        contactNumber
      }
    }
  }
`;
