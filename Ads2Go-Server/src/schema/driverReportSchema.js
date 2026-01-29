const gql = require('graphql-tag');

const typeDefs = gql`
  # Enums
  enum DriverReportType {
    BUG
    PAYMENT
    ACCOUNT
    VEHICLE_ISSUE
    MATERIAL_ISSUE
    APP_ISSUE
    REQUEST_ACCOUNT_CLOSURE
    UPDATE_PROFILE_DETAILS
    OTHER
  }

  enum DriverReportStatus {
    PENDING
    IN_PROGRESS
    RESOLVED
    CLOSED
  }

  # Types
  type DriverReport {
    id: ID!
    driverId: ID!
    driver: Driver
    title: String!
    description: String!
    reportType: DriverReportType!
    status: DriverReportStatus!
    attachments: [String!]
    adminNotes: String
    adminNotesUpdatedAt: String
    adminNotesBy: AdminInfo
    createdAt: String!
    updatedAt: String!
    resolvedAt: String
    # Archive fields (30-day deferred deletion)
    isArchived: Boolean!
    archivedAt: String
    scheduledDeletionDate: String
  }

  type DriverReportResponse {
    success: Boolean!
    message: String!
    report: DriverReport
  }

  type DriverReportListResponse {
    success: Boolean!
    message: String!
    reports: [DriverReport!]!
    totalCount: Int!
  }

  # Inputs
  input CreateDriverReportInput {
    title: String!
    description: String!
    reportType: DriverReportType!
    attachments: [String!]
  }

  input UpdateDriverReportInput {
    title: String
    description: String
    reportType: DriverReportType
    attachments: [String!]
  }

  input DriverReportFiltersInput {
    reportType: DriverReportType
    status: DriverReportStatus
    startDate: String
    endDate: String
    includeArchived: Boolean
  }

  # Admin input for updating driver reports
  input AdminUpdateDriverReportInput {
    status: DriverReportStatus
    adminNotes: String
  }

  # Queries
  extend type Query {
    # Get driver's own reports
    getDriverReports(filters: DriverReportFiltersInput, limit: Int, offset: Int): DriverReportListResponse!
    getDriverReportById(id: ID!): DriverReport
    
    # Admin queries
    getAllDriverReports(filters: DriverReportFiltersInput, limit: Int, offset: Int): DriverReportListResponse!
    getDriverReportByIdAdmin(id: ID!): DriverReport
  }

  # Mutations
  extend type Mutation {
    # Create a new driver report
    createDriverReport(input: CreateDriverReportInput!): DriverReportResponse!
    
    # Update driver's own report (only if status is PENDING)
    updateDriverReport(id: ID!, input: UpdateDriverReportInput!): DriverReportResponse!
    
    # Cancel/delete driver's own report (only if status is PENDING)
    deleteDriverReport(id: ID!): DriverReportResponse!
    
    # Restore archived report
    restoreDriverReport(id: ID!): DriverReportResponse!
    
    # Admin mutations
    updateDriverReportAdmin(id: ID!, input: AdminUpdateDriverReportInput!): DriverReportResponse!
    deleteDriverReportAdmin(id: ID!): DriverReportResponse!
  }
`;

module.exports = typeDefs;

