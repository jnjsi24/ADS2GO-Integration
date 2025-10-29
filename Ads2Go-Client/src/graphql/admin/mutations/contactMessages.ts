import { gql } from '@apollo/client';

export const UPDATE_CONTACT_MESSAGE = gql`
  mutation UpdateContactMessage($id: ID!, $input: UpdateContactMessageInput!) {
    updateContactMessage(id: $id, input: $input) {
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

export const SEND_CONTACT_REPLY = gql`
  mutation SendContactReply($input: SendContactReplyInput!) {
    sendContactReply(input: $input) {
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

