import { gql } from '@apollo/client';

export const CREATE_USER_REPORT = gql`
  mutation CreateUserReport($input: CreateUserReportInput!) {
    createUserReport(input: $input) {
      success
      message
      report {
        id
        title
        description
        reportType
        status
        attachments
        createdAt
        updatedAt
      }
    }
  }
`;

export const UPDATE_USER_REPORT = gql`
  mutation UpdateUserReport($id: ID!, $input: UpdateUserReportInput!) {
    updateUserReport(id: $id, input: $input) {
      success
      message
      report {
        id
        title
        description
        reportType
        status
        attachments
        createdAt
        updatedAt
      }
    }
  }
`;

export const DELETE_USER_REPORT = gql`
  mutation DeleteUserReport($id: ID!) {
    deleteUserReport(id: $id) {
      success
      message
    }
  }
`;
