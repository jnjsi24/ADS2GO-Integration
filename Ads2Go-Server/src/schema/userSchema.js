const gql = require('graphql-tag');

const typeDefs = gql`
  # Enums
  enum UserRole {
    ADMIN
    SUPERADMIN
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

  input CreateAdminInput {
    firstName: String!
    middleName: String
    lastName: String!
    companyName: String!
    companyAddress: String!
    contactNumber: String!
    email: String!
    password: String!
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
  }

  input UpdateAdminDetailsInput {
    firstName: String
    middleName: String
    lastName: String
    companyName: String
    companyAddress: String
    contactNumber: String
    email: String
    password: String
  }

  input DeviceInfoInput {
    deviceId: String!
    deviceType: String!
    deviceName: String!
  }

  # Queries
  type Query {
    # Admin queries
    getAllUsers: [User!]!
    getUserById(id: ID!): User
    getAllAdmins: [User!]!

    # User queries
    getOwnUserDetails: User
    checkPasswordStrength(password: String!): PasswordStrength!
  }

  # Mutations
  type Mutation {
    # User authentication
    createUser(input: CreateUserInput!): AuthPayload!
    loginUser(email: String!, password: String!, deviceInfo: DeviceInfoInput!): AuthPayload!
    logout: Boolean!
    logoutAllSessions: Boolean!

    # Admin authentication
    loginAdmin(email: String!, password: String!, deviceInfo: DeviceInfoInput!): AuthPayload!

    # User management
    updateUser(input: UpdateUserInput!): UserUpdateResponse!
    deleteUser(id: ID!): ResponseMessage!

    # Admin management
    createAdminUser(input: CreateAdminInput!): UserUpdateResponse!
    updateAdminDetails(adminId: ID!, input: UpdateAdminDetailsInput!): UserUpdateResponse!

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
