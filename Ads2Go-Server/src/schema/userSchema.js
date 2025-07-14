const gql = require('graphql-tag');

const typeDefs = gql`
  enum UserRole {
    USER
    ADMIN
  }

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
    role: UserRole!
    isEmailVerified: Boolean!
    lastLogin: String
    createdAt: String!
    updatedAt: String!
  }

  type UserUpdateResponse {
    success: Boolean!
    message: String!
    user: User!
  }

  type ResponseMessage {
    success: Boolean!
    message: String!
  }

  type Session {
    sessionId: String!
    deviceInfo: DeviceInfo!
    createdAt: String!
    lastActivity: String!
  }

  type DeviceInfo {
    userAgent: String!
    ip: String!
    platform: String!
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
  }

  input DeviceInfoInput {
    deviceId: String!
    deviceType: String!
    deviceName: String!
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

  type Query {
    # Admin queries
    getAllUsers: [User!]!
    getUserById(id: ID!): User
    getUserSessions(userId: ID!): [Session!]!
    
    # User queries
    getOwnUserDetails: User
    checkPasswordStrength(password: String!): PasswordStrength!
    getMyActiveSessions: [Session!]!
  }

  type Mutation {
  # User mutations
  createUser(input: CreateUserInput!): AuthPayload!
  updateUser(input: UpdateUserInput!): UserUpdateResponse!
  deleteUser(id: ID!): ResponseMessage!
  login(email: String!, password: String!, deviceInfo: DeviceInfoInput!): AuthPayload!
  logout: Boolean!
  logoutAllSessions: Boolean!

  # Admin management
  createAdminUser(input: CreateUserInput!): UserUpdateResponse!

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
