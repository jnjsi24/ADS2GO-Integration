const gql = require('graphql-tag');

const typeDefs = gql`
  # Enums
  enum UserRole {
    USER
  }

  # Types
  type User {
    id: ID!
    firstName: String!
    middleName: String
    lastName: String!
    email: String!
    companyName: String!
    companyAddress: String!
    houseAddress: String
    contactNumber: String!
    profilePicture: String
    role: UserRole!
    isEmailVerified: Boolean!
    lastLogin: String
    createdAt: String!
    updatedAt: String!
    ads: [Ad!]
    notificationPreferences: UserNotificationPreferences!
    isArchived: Boolean!
    archivedAt: String
    scheduledDeletionDate: String
    reasonForDeletion: String
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  type VerificationResponse {
    success: Boolean!
    message: String
    token: String
  }

  type ResponseMessage {
    success: Boolean!
    message: String!
  }

  type UserUpdateResponse {
    success: Boolean!
    message: String!
    user: User!
  }

  type UserNotificationPreferences {
    enableDesktopNotifications: Boolean!
    enableNotificationBadge: Boolean!
    pushNotificationTimeout: String!
    communicationEmails: Boolean!
    announcementsEmails: Boolean!
  }

  type QueuedEmailStats {
    pending: Int!
    sent: Int!
    failed: Int!
    cancelled: Int!
  }

  type PasswordStrength {
    score: Float!
    strong: Boolean!
    errors: PasswordErrors
  }

  type PasswordErrors {
    length: String
    hasUpperCase: String
    hasLowerCase: String
    hasNumbers: String
    hasSpecialChar: String
  }

  # Analytics Types - Updated for UserAnalytics system
  type UserAnalyticsSummary {
    totalAdsPlayed: Int!
    totalDisplayTime: Float!
    averageCompletionRate: Float!
    totalAds: Int!
    activeAds: Int!
    totalMaterials: Int!
    totalDevices: Int!
    totalQRScans: Int!
  }

  type UserAdPerformance {
    adId: String!
    adTitle: String!
    totalMaterials: Int!
    totalDevices: Int!
    totalAdPlayTime: Float!
    totalQRScans: Int!
    averageAdCompletionRate: Float!
    lastUpdated: String!
    materials: [UserMaterialPerformance!]!
  }

  type UserMaterialPerformance {
    materialId: String!
    materialName: String
    carGroupId: String
    totalAdPlayTime: Float!
    totalQRScans: Int!
    averageCompletionRate: Float!
    lastActivity: String
  }

  type UserDailyStats {
    date: String!
    adsPlayed: Int!
    displayTime: Float!
    qrScans: Int!
    completionRate: Float!
  }

  type UserDeviceStats {
    deviceId: String!
    materialId: String!
    adsPlayed: Int!
    displayTime: Float!
    lastActivity: String
    isOnline: Boolean!
    qrScans: Int!
  }

  type MaterialLocation {
    lat: Float
    lng: Float
    timestamp: String
    speed: Float
    heading: Float
    accuracy: Float
    address: String
  }

  type UserMaterialWithLocation {
    materialId: String!
    materialName: String
    materialType: String
    vehicleType: String
    category: String
    isOnline: Boolean!
    lastSeen: String
    currentLocation: MaterialLocation
    totalAdPlays: Int
    totalQRScans: Int
    totalAdPlayTime: Float
    carGroupId: String
    screenType: String
    ads: [UserMaterialAd!]
  }

  type UserMaterialAd {
    adId: String!
    adTitle: String!
    adType: String
    adFormat: String
    status: String
    adStatus: String
  }

  type UserMaterialsWithLocationResponse {
    success: Boolean!
    message: String
    totalMaterials: Int!
    activeMaterials: Int!
    materials: [UserMaterialWithLocation!]!
  }

  type UserAnalytics {
    summary: UserAnalyticsSummary!
    adPerformance: [UserAdPerformance!]!
    dailyStats: [UserDailyStats!]!
    deviceStats: [UserDeviceStats!]!
    period: String!
    startDate: String
    endDate: String
    lastUpdated: String!
    isActive: Boolean!
  }

  type UserAdDetails {
    adId: String!
    adTitle: String!
    adDescription: String
    adFormat: String!
    status: String!
    createdAt: String!
    startTime: String
    endTime: String
    totalPlayTime: Int!
    averageCompletionRate: Float!
    devicePerformance: [UserDevicePerformance!]!
    dailyPerformance: [UserDailyPerformance!]!
  }

  type UserDevicePerformance {
    deviceId: String!
    materialId: String!
    playTime: Int!
    completionRate: Float!
    lastPlayed: String
  }

  type UserDailyPerformance {
    date: String!
    playTime: Int!
    completionRate: Float!
  }

  # Inputs
  input CreateUserInput {
    firstName: String!
    middleName: String
    lastName: String!
    companyName: String!
    companyAddress: String!
    contactNumber: String!
    email: String!
    password: String!
    houseAddress: String!
  }

  input CompleteGoogleOAuthInput {
    # Google OAuth data
    googleId: String!
    email: String!
    firstName: String!
    lastName: String!
    profilePicture: String
    
    # Additional required fields
    middleName: String
    companyName: String!
    companyAddress: String!
    contactNumber: String!
    houseAddress: String
  }

  input UpdateUserInput {
    firstName: String
    middleName: String
    lastName: String
    companyName: String
    companyAddress: String
    contactNumber: String
    email: String
    houseAddress: String
    password: String
    profilePicture: String
  }

  input DeviceInfoInput {
    deviceId: String!
    deviceType: String!
    deviceName: String!
  }

  input UpdateUserNotificationPreferencesInput {
    enableDesktopNotifications: Boolean
    enableNotificationBadge: Boolean
    pushNotificationTimeout: String
    communicationEmails: Boolean
    announcementsEmails: Boolean
  }

  # Queries
  type Query {
    # User queries
    getOwnUserDetails: User
    checkPasswordStrength(password: String!): PasswordStrength!
    getUserAnalytics(startDate: String, endDate: String, period: String, adId: String): UserAnalytics
    getUserAdDetails(adId: String!): UserAdDetails
    getUserNotificationPreferences: UserNotificationPreferences!
    getQueuedEmailStats: QueuedEmailStats!
    getUserMaterialsWithLocation: UserMaterialsWithLocationResponse!
  }

  # Mutations
  type Mutation {
    # User authentication
    createUser(input: CreateUserInput!): AuthPayload!
    loginUser(email: String!, password: String!, deviceInfo: DeviceInfoInput!, keepLoggedIn: Boolean): AuthPayload!
    completeGoogleOAuthProfile(input: CompleteGoogleOAuthInput!): AuthPayload!
    logout: Boolean!
    logoutAllSessions: Boolean!

    # User management
    updateUser(input: UpdateUserInput!): UserUpdateResponse!
    deleteOwnAccount: ResponseMessage!
    restoreOwnAccount: ResponseMessage!

    # Email verification
    verifyEmail(code: String!): VerificationResponse
    resendVerificationCode(email: String!): VerificationResponse

    # Password management
    requestPasswordReset(email: String!): Boolean!
    resetPassword(token: String!, newPassword: String!): Boolean!
    changePassword(currentPassword: String!, newPassword: String!): Boolean!

    # Notification preferences
    updateUserNotificationPreferences(input: UpdateUserNotificationPreferencesInput!): UserUpdateResponse!
  }
`;

module.exports = typeDefs;
