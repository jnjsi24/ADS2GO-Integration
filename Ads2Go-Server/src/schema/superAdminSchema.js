const gql = require('graphql-tag');

const typeDefs = gql`
  # Enums
  enum SuperAdminRole {
    SUPERADMIN
  }

  # Types

  type SuperAdmin {
    id: ID!
    firstName: String!
    middleName: String
    lastName: String!
    email: String!
    companyName: String!
    companyAddress: String!
    contactNumber: String!
    role: SuperAdminRole!
    isEmailVerified: Boolean!
    isActive: Boolean!
    lastLogin: String
    createdAt: String!
    updatedAt: String!
    permissions: SuperAdminPermissions!
  }

  type SuperAdminPermissions {
    userManagement: Boolean!
    adminManagement: Boolean!
    adManagement: Boolean!
    driverManagement: Boolean!
    tabletManagement: Boolean!
    paymentManagement: Boolean!
    reports: Boolean!
    systemSettings: Boolean!
    databaseManagement: Boolean!
    auditLogs: Boolean!
  }

  type AuthPayload {
    token: String!
    superAdmin: SuperAdmin!
  }

  type SuperAdminResponse {
    success: Boolean!
    message: String!
    superAdmin: SuperAdmin!
  }

  type SuperAdminListResponse {
    success: Boolean!
    message: String!
    superAdmins: [SuperAdmin!]!
    totalCount: Int!
  }

  # Admin management response types (for SuperAdmins)
  type AdminResponse {
    success: Boolean!
    message: String!
    admin: Admin!
  }

  type ResponseMessage {
    success: Boolean!
    message: String!
  }

  # Inputs
  input CreateSuperAdminInput {
    firstName: String!
    middleName: String
    lastName: String!
    companyName: String!
    companyAddress: String!
    contactNumber: String!
    email: String!
    password: String!
  }

  input UpdateSuperAdminInput {
    firstName: String
    middleName: String
    lastName: String
    companyName: String
    companyAddress: String
    contactNumber: String
    email: String
    password: String
    isActive: Boolean
    permissions: UpdateSuperAdminPermissionsInput
  }

  input UpdateSuperAdminPermissionsInput {
    userManagement: Boolean
    adminManagement: Boolean
    adManagement: Boolean
    driverManagement: Boolean
    tabletManagement: Boolean
    paymentManagement: Boolean
    reports: Boolean
    systemSettings: Boolean
    databaseManagement: Boolean
    auditLogs: Boolean
  }

  # Admin management inputs (for SuperAdmins)
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
    getAllSuperAdmins: SuperAdminListResponse!
    getSuperAdminById(id: ID!): SuperAdmin
    getOwnSuperAdminDetails: SuperAdmin
  }

  # Mutations
  type Mutation {
    # SuperAdmin authentication
    loginSuperAdmin(email: String!, password: String!, deviceInfo: DeviceInfoInput!): AuthPayload!
    logoutSuperAdmin: Boolean!
    logoutAllSuperAdminSessions: Boolean!

    # SuperAdmin management
    createSuperAdmin(input: CreateSuperAdminInput!): SuperAdminResponse!
    updateSuperAdmin(superAdminId: ID!, input: UpdateSuperAdminInput!): SuperAdminResponse!
    deleteSuperAdmin(id: ID!): SuperAdminResponse!
    activateSuperAdmin(id: ID!): SuperAdminResponse!
    deactivateSuperAdmin(id: ID!): SuperAdminResponse!

    # Admin management (for SuperAdmins)
    createAdmin(input: CreateAdminInput!): AdminResponse!
    updateAdmin(adminId: ID!, input: UpdateAdminInput!): AdminResponse!
    deleteAdmin(id: ID!): AdminResponse!
    activateAdmin(id: ID!): AdminResponse!
    deactivateAdmin(id: ID!): AdminResponse!

    # User management (for SuperAdmins)
    # Note: deleteUser is handled by adminResolver for both ADMIN and SUPERADMIN roles

    # Password management
    changeSuperAdminPassword(currentPassword: String!, newPassword: String!): Boolean!
    requestSuperAdminPasswordReset(email: String!): Boolean!
    resetSuperAdminPassword(token: String!, newPassword: String!): Boolean!
  }
`;

module.exports = typeDefs;
