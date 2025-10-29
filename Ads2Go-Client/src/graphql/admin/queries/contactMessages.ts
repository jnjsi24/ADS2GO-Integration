import { gql } from '@apollo/client';

export const GET_ALL_CONTACT_MESSAGES = gql`
  query GetAllContactMessages($filters: ContactMessageFilters, $limit: Int, $offset: Int) {
    getAllContactMessages(filters: $filters, limit: $limit, offset: $offset) {
      success
      message
      contactMessages {
        id
        name
        email
        message
        status
        category
        adminReply {
          subject
          message
          sentBy {
            adminId
            adminName
            adminEmail
          }
          sentAt
        }
        resolvedAt
        resolvedBy {
          adminId
          adminName
          adminEmail
        }
        createdAt
        updatedAt
      }
      totalCount
      statusCounts {
        pending
        inProgress
        resolved
        total
      }
    }
  }
`;

export const GET_CONTACT_MESSAGE_BY_ID = gql`
  query GetContactMessageById($id: ID!) {
    getContactMessageById(id: $id) {
      success
      message
      contactMessage {
        id
        name
        email
        message
        status
        category
        adminReply {
          subject
          message
          sentBy {
            adminId
            adminName
            adminEmail
          }
          sentAt
        }
        resolvedAt
        resolvedBy {
          adminId
          adminName
          adminEmail
        }
        createdAt
        updatedAt
      }
    }
  }
`;

