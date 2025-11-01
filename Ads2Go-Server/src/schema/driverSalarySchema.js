const gql = require('graphql-tag');

const typeDefs = gql`
  # Enums
  enum SalaryCalculationStatus {
    PENDING
    CALCULATED
    APPROVED
    PAID
    DISPUTED
  }

  enum SalaryPeriodType {
    DAILY
    WEEKLY
    MONTHLY
    CUSTOM
  }

  # Types
  type DriverSalaryPricing {
    id: ID!
    vehicleType: VehicleType!
    category: MaterialCategory!
    materialType: MaterialTypeEnum!
    distanceRate: Float!
    hoursRate: Float!
    isActive: Boolean!
    createdBy: SuperAdmin!
    updatedBy: SuperAdmin
    notes: String
    displayName: String!
    createdAt: String!
    updatedAt: String!
    # Archive fields (30-day deferred deletion)
    isArchived: Boolean!
    archivedAt: String
    scheduledDeletionDate: String
  }

  type SalaryCalculationPeriod {
    startDate: String!
    endDate: String!
    periodType: SalaryPeriodType!
  }

  type SalaryRawData {
    totalDistance: Float!
    totalHours: Float!
    daysWorked: Int!
  }

  type SalaryPricingConfig {
    vehicleType: VehicleType!
    category: MaterialCategory!
    materialType: MaterialTypeEnum!
    distanceRate: Float!
    hoursRate: Float!
  }

  type SalaryCalculations {
    distanceComputation: Float!
    hoursComputation: Float!
    totalSalary: Float!
  }

  type DriverSalaryCalculation {
    id: ID!
    driverId: String!
    driverName: String!
    driver: Driver
    materialId: ID!
    material: Material
    deviceId: String!
    calculationPeriod: SalaryCalculationPeriod!
    rawData: SalaryRawData!
    pricingConfig: SalaryPricingConfig!
    calculations: SalaryCalculations!
    status: SalaryCalculationStatus!
    approvedBy: SuperAdmin
    approvedAt: String
    paidAt: String
    paymentReference: String
    notes: String
    disputeReason: String
    periodDisplay: String!
    isActive: Boolean!
    createdAt: String!
    updatedAt: String!
  }

  type DriverSalarySummary {
    driverId: String!
    driver: Driver
    totalCalculations: Int!
    totalSalary: Float!
    totalDistanceSalary: Float!
    totalHoursSalary: Float!
    averageMonthlySalary: Float!
    lastCalculationDate: String
    currentStatus: SalaryCalculationStatus
  }

  # Response Types
  type DriverSalaryPricingResponse {
    success: Boolean!
    message: String!
    pricing: DriverSalaryPricing
  }

  type DriverSalaryPricingListResponse {
    success: Boolean!
    message: String!
    pricingList: [DriverSalaryPricing!]!
    totalCount: Int!
  }

  type DriverSalaryCalculationResponse {
    success: Boolean!
    message: String!
    calculation: DriverSalaryCalculation
  }

  type DriverSalaryCalculationListResponse {
    success: Boolean!
    message: String!
    calculations: [DriverSalaryCalculation!]!
    totalCount: Int!
  }

  type DriverSalarySummaryResponse {
    success: Boolean!
    message: String!
    summary: DriverSalarySummary
  }

  # Input Types
  input CreateDriverSalaryPricingInput {
    vehicleType: VehicleType!
    category: MaterialCategory!
    materialType: MaterialTypeEnum!
    distanceRate: Float!
    hoursRate: Float!
    notes: String
  }

  input UpdateDriverSalaryPricingInput {
    distanceRate: Float
    hoursRate: Float
    isActive: Boolean
    notes: String
  }

  input CreateDriverSalaryCalculationInput {
    driverId: String!
    driverName: String!
    materialId: ID!
    deviceId: String!
    calculationPeriod: SalaryCalculationPeriodInput!
    rawData: SalaryRawDataInput!
    pricingConfig: SalaryPricingConfigInput!
    notes: String
  }

  input SalaryCalculationPeriodInput {
    startDate: String!
    endDate: String!
    periodType: SalaryPeriodType!
  }

  input SalaryRawDataInput {
    totalDistance: Float!
    totalHours: Float!
    daysWorked: Int!
  }

  input SalaryPricingConfigInput {
    vehicleType: VehicleType!
    category: MaterialCategory!
    materialType: MaterialTypeEnum!
    distanceRate: Float!
    hoursRate: Float!
  }

  input UpdateDriverSalaryCalculationInput {
    status: SalaryCalculationStatus
    notes: String
    disputeReason: String
    paymentReference: String
  }

  input DriverSalaryCalculationFilter {
    driverId: String
    materialId: ID
    status: SalaryCalculationStatus
    startDate: String
    endDate: String
    periodType: SalaryPeriodType
  }

  # Queries
  extend type Query {
    # Super Admin queries
    getAllDriverSalaryPricing: DriverSalaryPricingListResponse!
    getDriverSalaryPricingById(id: ID!): DriverSalaryPricing
    getDriverSalaryPricingByConfig(vehicleType: VehicleType!, category: MaterialCategory!, materialType: MaterialTypeEnum!): DriverSalaryPricing
    
    getAllDriverSalaryCalculations(filter: DriverSalaryCalculationFilter): DriverSalaryCalculationListResponse!
    getDriverSalaryCalculationById(id: ID!): DriverSalaryCalculation
    getDriverSalaryCalculationsByDriver(driverId: String!): DriverSalaryCalculationListResponse!
    getDriverSalarySummary(driverId: String!): DriverSalarySummaryResponse!
    
    # Driver queries (limited access)
    getMySalaryCalculations: DriverSalaryCalculationListResponse!
    getMySalarySummary: DriverSalarySummaryResponse!
  }

  # Mutations
  extend type Mutation {
    # Super Admin mutations
    createDriverSalaryPricing(input: CreateDriverSalaryPricingInput!): DriverSalaryPricingResponse!
    updateDriverSalaryPricing(id: ID!, input: UpdateDriverSalaryPricingInput!): DriverSalaryPricingResponse!
    deleteDriverSalaryPricing(id: ID!): DriverSalaryPricingResponse!
    restoreDriverSalaryPricing(id: ID!): DriverSalaryPricingResponse!
    
    createDriverSalaryCalculation(input: CreateDriverSalaryCalculationInput!): DriverSalaryCalculationResponse!
    updateDriverSalaryCalculation(id: ID!, input: UpdateDriverSalaryCalculationInput!): DriverSalaryCalculationResponse!
    approveDriverSalaryCalculation(id: ID!): DriverSalaryCalculationResponse!
    markDriverSalaryAsPaid(id: ID!, paymentReference: String!): DriverSalaryCalculationResponse!
    
    # Automatic calculation generation
    generateMonthlySalaryCalculations(month: String!, year: Int!): DriverSalaryCalculationListResponse!
    recalculateDriverSalary(id: ID!): DriverSalaryCalculationResponse!
  }
`;

module.exports = typeDefs;
