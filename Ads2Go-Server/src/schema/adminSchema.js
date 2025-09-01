const gql = require('graphql-tag');

const typeDefs = gql`
  # Enums
  enum AdminRole {
    ADMIN
  }

  # Types
  type Admin {
    id: ID!
    firstName: String!
    middleName: String
    lastName: String!
    email: String!
    companyName: String!
    companyAddress: String!
    contactNumber: String!
    profilePicture: String
    role: AdminRole!
    isEmailVerified: Boolean!
    isActive: Boolean!
    lastLogin: String
    createdAt: String!
    updatedAt: String!
    permissions: AdminPermissions!
  }

  type AdminPermissions {
    userManagement: Boolean!
    adManagement: Boolean!
    driverManagement: Boolean!
    tabletManagement: Boolean!
    paymentManagement: Boolean!
    reports: Boolean!
  }

  type AuthPayload {
    token: String!
    admin: Admin!
  }

  type AdminResponse {
    success: Boolean!
    message: String!
    admin: Admin!
  }

  type AdminListResponse {
    success: Boolean!
    message: String!
    admins: [Admin!]!
    totalCount: Int!
  }

  type ResponseMessage {
    success: Boolean!
    message: String!
  }

  # Inputs
  input CreateAdminInput {
    firstName: String!
    middleName: String
    lastName: String!
    companyName: String!
    companyAddress: String!
    contactNumber: String!
    email: String!
    password: String!
    profilePicture: String
  }

  input UpdateAdminInput {
    firstName: String
    middleName: String
    lastName: String
    companyName: String
    companyAddress: String
    contactNumber: String
    email: String
    password: String
    profilePicture: String
    isActive: Boolean
    permissions: UpdateAdminPermissionsInput
  }

  input UpdateAdminPermissionsInput {
    userManagement: Boolean
    adManagement: Boolean
    driverManagement: Boolean
    tabletManagement: Boolean
    paymentManagement: Boolean
    reports: Boolean
  }

  input DeviceInfoInput {
    deviceId: String!
    deviceType: String!
    deviceName: String!
  }

  # Queries
  type Query {
    getAllAdmins: AdminListResponse!
    getAdminById(id: ID!): Admin
    getOwnAdminDetails: Admin
    getAllUsers: [User!]!
  }

  # Mutations
  type Mutation {
    # Admin authentication
    loginAdmin(email: String!, password: String!, deviceInfo: DeviceInfoInput!): AuthPayload!
    logoutAdmin: Boolean!
    logoutAllAdminSessions: Boolean!

    # Admin management
    createAdmin(input: CreateAdminInput!): AdminResponse!
    updateAdmin(adminId: ID!, input: UpdateAdminInput!): AdminResponse!
    deleteAdmin(id: ID!): AdminResponse!
    activateAdmin(id: ID!): AdminResponse!
    deactivateAdmin(id: ID!): AdminResponse!

    # User management
    deleteUser(id: ID!): ResponseMessage!

    # Password management
    changeAdminPassword(currentPassword: String!, newPassword: String!): Boolean!
    requestAdminPasswordReset(email: String!): Boolean!
    resetAdminPassword(token: String!, newPassword: String!): Boolean!
  }
`;

module.exports = typeDefs;
