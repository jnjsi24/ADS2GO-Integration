const gql = require('graphql-tag');

const typeDefs = gql`
  enum UserRole {
    USER
    ADMIN
    SUPERADMIN
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
    profilePicture: String
    lastLogin: String
    createdAt: String!
    updatedAt: String!
    ads: [Ad!]
  }
    type Query {
    getAllUsers: [User!]!
    }

  type UserUpdateResponse {
    success: Boolean!
    message: String!
    user: User!
  }

  input CreateUserInput {
    firstName: String!
    middleName: String
    lastName: String!
    email: String!
    password: String!
    companyName: String!
    companyAddress: String!
    contactNumber: String!
    houseAddress: String
    role: UserRole # Optional for createUser, mandatory for createAdminUser
  }

  input LoginInput {
    email: String!
    password: String!
    deviceInfo: DeviceInfoInput!
  }

  input ForgotPasswordInput {
    email: String!
  }

  input ResetPasswordInput {
    token: String!
    password: String!
  }

  input UpdateUserInput {
    id: ID! # <--- ADD THIS LINE
    firstName: String
    middleName: String
    lastName: String
    email: String
    companyName: String
    companyAddress: String
    houseAddress: String
    contactNumber: String
    profilePicture: String
  }

  input UpdateUserProfileInput {
    firstName: String
    middleName: String
    lastName: String
    houseAddress: String
    contactNumber: String
    profilePicture: String
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

  input DeviceInfoInput {
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
    hasSymbols: String
  }

  type AuthPayload {
    token: String
    user: User
  }

  type Query {
    getAllUsers: [User!]!
    getUserById(id: ID!): User
    getOwnUserDetails: User
    checkPasswordStrength(password: String!): PasswordStrength
  }

  type Mutation {
    createUser(input: CreateUserInput!): AuthPayload!
    login(input: LoginInput!): AuthPayload!
    logout: ResponseMessage!
    forgotPassword(input: ForgotPasswordInput!): ResponseMessage!
    resetPassword(input: ResetPasswordInput!): ResponseMessage!
    verifyEmail(token: String!): ResponseMessage!
    updateUser(input: UpdateUserInput!): UserUpdateResponse!
    updateUserProfile(input: UpdateUserProfileInput!): UserUpdateResponse!
    deleteUser(id: ID!): ResponseMessage!
    createAdminUser(input: CreateUserInput!): UserUpdateResponse!
  }
`;

module.exports = typeDefs;