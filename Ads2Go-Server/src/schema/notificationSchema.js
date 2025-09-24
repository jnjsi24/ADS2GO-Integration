const gql = require('graphql-tag');

const notificationTypeDefs = gql`
  enum NotificationType {
    SUCCESS
    INFO
    WARNING
    ERROR
  }

  type Notification {
    id: ID!
    userId: User!
    title: String!
    message: String!
    type: NotificationType!
    read: Boolean!
    readAt: String
    adId: ID
    adTitle: String
    createdAt: String!
    updatedAt: String!
  }

  input CreateNotificationInput {
    userId: ID!
    title: String!
    message: String!
    type: NotificationType!
    adId: ID
    adTitle: String
  }

  input UpdateNotificationInput {
    title: String
    message: String
    type: NotificationType
    read: Boolean
  }

  type NotificationResponse {
    success: Boolean!
    message: String!
    notification: Notification
  }

  type Query {
    getUserNotifications: [Notification!]!
    getNotificationById(id: ID!): Notification
    getUnreadNotificationCount: Int!
  }

  type Mutation {
    createNotification(input: CreateNotificationInput!): Notification!
    updateNotification(id: ID!, input: UpdateNotificationInput!): Notification!
    markNotificationAsRead(id: ID!): Notification!
    markAllNotificationsAsRead: NotificationResponse!
    deleteNotification(id: ID!): NotificationResponse!
  }

  type Subscription {
    notificationReceived: Notification!
  }
`;

module.exports = notificationTypeDefs;
