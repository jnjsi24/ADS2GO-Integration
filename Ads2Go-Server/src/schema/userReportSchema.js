const gql = require('graphql-tag');

const typeDefs = gql`
  # Enums
  enum ReportType {
    BUG
    PAYMENT
    ACCOUNT
    CONTENT_VIOLATION
    FEATURE_REQUEST
    OTHER
  }

  enum ReportStatus {
    PENDING
    IN_PROGRESS
    RESOLVED
    CLOSED
  }


  # Types
  type UserReport {
    id: ID!
    userId: ID!
    user: User!
    title: String!
    description: String!
    reportType: ReportType!
    status: ReportStatus!
    attachments: [String!]
    adminNotes: String
    createdAt: String!
    updatedAt: String!
    resolvedAt: String
  }

  type UserReportResponse {
    success: Boolean!
    message: String!
    report: UserReport
  }

  type UserReportListResponse {
    success: Boolean!
    message: String!
    reports: [UserReport!]!
    totalCount: Int!
  }

  # Inputs
  input CreateUserReportInput {
    title: String!
    description: String!
    reportType: ReportType!
    attachments: [String!]
  }

  input UpdateUserReportInput {
    title: String
    description: String
    reportType: ReportType
    attachments: [String!]
  }

  input UserReportFiltersInput {
    reportType: ReportType
    status: ReportStatus
    startDate: String
    endDate: String
  }

  # Admin input for updating reports
  input AdminUpdateUserReportInput {
    status: ReportStatus
    adminNotes: String
  }

  # Queries
  type Query {
    # Get user's own reports
    getUserReports(filters: UserReportFiltersInput, limit: Int, offset: Int): UserReportListResponse!
    getUserReportById(id: ID!): UserReport
    
    # Admin queries
    getAllUserReports(filters: UserReportFiltersInput, limit: Int, offset: Int): UserReportListResponse!
    getUserReportByIdAdmin(id: ID!): UserReport
  }

  # Mutations
  type Mutation {
    # Create a new report
    createUserReport(input: CreateUserReportInput!): UserReportResponse!
    
    # Update user's own report (only if status is PENDING)
    updateUserReport(id: ID!, input: UpdateUserReportInput!): UserReportResponse!
    
    # Cancel/delete user's own report (only if status is PENDING)
    deleteUserReport(id: ID!): UserReportResponse!
    
    # Admin mutations
    updateUserReportAdmin(id: ID!, input: AdminUpdateUserReportInput!): UserReportResponse!
  }
`;

module.exports = typeDefs;
