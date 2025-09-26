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

  # Analytics Types
  type UserAnalyticsSummary {
    totalAdImpressions: Int!
    totalAdsPlayed: Int!
    totalDisplayTime: Float!
    averageCompletionRate: Float!
    totalAds: Int!
    activeAds: Int!
  }

  type UserAdPerformance {
    adId: String!
    adTitle: String!
    impressions: Int!
    totalPlayTime: Float!
    averageCompletionRate: Float!
    playCount: Int!
    lastPlayed: String
  }

  type UserDailyStats {
    date: String!
    impressions: Int!
    adsPlayed: Int!
    displayTime: Float!
  }

  type UserDeviceStats {
    deviceId: String!
    materialId: String!
    impressions: Int!
    adsPlayed: Int!
    displayTime: Float!
    lastActivity: String
    isOnline: Boolean!
  }

  type UserAnalytics {
    summary: UserAnalyticsSummary!
    adPerformance: [UserAdPerformance!]!
    dailyStats: [UserDailyStats!]!
    deviceStats: [UserDeviceStats!]!
    period: String!
    startDate: String
    endDate: String
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
    totalImpressions: Int!
    totalPlayTime: Int!
    averageCompletionRate: Float!
    devicePerformance: [UserDevicePerformance!]!
    dailyPerformance: [UserDailyPerformance!]!
  }

  type UserDevicePerformance {
    deviceId: String!
    materialId: String!
    impressions: Int!
    playTime: Int!
    completionRate: Float!
    lastPlayed: String
  }

  type UserDailyPerformance {
    date: String!
    impressions: Int!
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

  # Queries
  type Query {
    # User queries
    getOwnUserDetails: User
    checkPasswordStrength(password: String!): PasswordStrength!
    getUserAnalytics(startDate: String, endDate: String, period: String): UserAnalytics
    getUserAdDetails(adId: String!): UserAdDetails
  }

  # Mutations
  type Mutation {
    # User authentication
    createUser(input: CreateUserInput!): AuthPayload!
    loginUser(email: String!, password: String!, deviceInfo: DeviceInfoInput!): AuthPayload!
    logout: Boolean!
    logoutAllSessions: Boolean!

    # User management
    updateUser(input: UpdateUserInput!): UserUpdateResponse!

    # Email verification
    verifyEmail(code: String!): VerificationResponse
    resendVerificationCode(email: String!): VerificationResponse

    # Password management
    requestPasswordReset(email: String!): Boolean!
    resetPassword(token: String!, newPassword: String!): Boolean!
    changePassword(currentPassword: String!, newPassword: String!): Boolean!
  }
`;

module.exports = typeDefs;
