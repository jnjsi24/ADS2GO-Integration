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
    category: String
    priority: String
    read: Boolean!
    readAt: String
    adId: ID
    adTitle: String
    data: String
    createdAt: String!
    updatedAt: String!
  }

  type AdminNotifications {
    notifications: [Notification!]!
    unreadCount: Int!
  }

  type PendingAd {
    id: ID!
    title: String!
    status: String!
    createdAt: String!
    user: User!
    materialId: ID
    planId: ID
  }

  type PendingMaterial {
    id: ID!
    materialId: String!
    materialType: String!
    vehicleType: String!
    category: String!
    createdAt: String!
    driver: Driver!
  }

  type AdminDashboardStats {
    totalAds: Int!
    pendingAds: Int!
    activeAds: Int!
    totalUsers: Int!
    newUsersToday: Int!
    totalDrivers: Int!
    newDriversToday: Int!
    totalRevenue: Float!
    revenueToday: Float!
    unreadNotifications: Int!
    highPriorityNotifications: Int!
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
    getAdminNotifications: AdminNotifications!
    getPendingAds: [PendingAd!]!
    getPendingMaterials: [PendingMaterial!]!
    getAdminDashboardStats: AdminDashboardStats!
  }

  type Mutation {
    createNotification(input: CreateNotificationInput!): Notification!
    updateNotification(id: ID!, input: UpdateNotificationInput!): Notification!
    markNotificationAsRead(id: ID!): Notification!
    markAllNotificationsAsRead: NotificationResponse!
    deleteNotification(id: ID!): NotificationResponse!
    deleteAllNotifications: NotificationResponse!
    deleteNotificationsByCategory(category: String!): NotificationResponse!
    markNotificationRead(notificationId: ID!): NotificationResponse!
    markAllNotificationsRead: NotificationResponse!
    deleteNotification(notificationId: ID!): NotificationResponse!
  }

  type Subscription {
    notificationReceived: Notification!
  }
`;

module.exports = notificationTypeDefs;
