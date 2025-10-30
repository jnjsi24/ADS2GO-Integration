const { gql } = require('apollo-server-express');

const contactMessageTypeDefs = gql`
  type ContactMessage {
    id: ID!
    name: String!
    email: String!
    message: String!
    status: ContactMessageStatus!
    category: String!
    adminReply: AdminReply
    resolvedAt: String
    resolvedBy: AdminInfo
    createdAt: String!
    updatedAt: String!
  }

  type AdminReply {
    subject: String
    message: String
    sentBy: AdminInfo
    sentAt: String
  }

  type AdminInfo {
    adminId: String
    adminName: String
    adminEmail: String
  }

  enum ContactMessageStatus {
    PENDING
    IN_PROGRESS
    RESOLVED
  }

  type ContactMessageResponse {
    success: Boolean!
    message: String!
    contactMessage: ContactMessage
  }

  type ContactMessagesResponse {
    success: Boolean!
    message: String
    contactMessages: [ContactMessage!]!
    totalCount: Int!
    statusCounts: StatusCounts
  }

  type StatusCounts {
    pending: Int!
    inProgress: Int!
    resolved: Int!
    total: Int!
  }

  input ContactMessageFilters {
    status: ContactMessageStatus
    email: String
    name: String
  }

  input UpdateContactMessageInput {
    status: ContactMessageStatus
  }

  input SendContactReplyInput {
    contactMessageId: ID!
    subject: String!
    message: String!
  }

  extend type Query {
    getAllContactMessages(
      filters: ContactMessageFilters
      limit: Int
      offset: Int
    ): ContactMessagesResponse!
    
    getContactMessageById(id: ID!): ContactMessageResponse!
  }

  extend type Mutation {
    updateContactMessage(
      id: ID!
      input: UpdateContactMessageInput!
    ): ContactMessageResponse!
    
    sendContactReply(
      input: SendContactReplyInput!
    ): ContactMessageResponse!
  }
`;

module.exports = contactMessageTypeDefs;

