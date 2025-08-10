const gql = require('graphql-tag');

const typeDefs = gql`
  enum DriverAccountStatus {
    PENDING
    ACTIVE
    SUSPENDED
    APPROVED
    REJECTED
    RESUBMITTED
  }

  enum DeviceStatus {
    ONLINE
    OFFLINE
    ERROR
  }

  enum InstalledMaterialType {
    LCD
    BANNER
    HEADDRESS
    STICKER
  }

  type Driver {
    id: ID!
    driverId: String!
    reviewStatus: String
    firstName: String!
    lastName: String!
    contactNumber: String!
    email: String!
    verified: Boolean!   # <-- Add this
    address: String!
    licenseNumber: String!
    licensePictureURL: String!
    vehiclePlateNumber: String!
    vehicleType: String!
    vehicleModel: String!
    vehicleYear: Int!
    vehiclePhotoURL: String!
    orCrPictureURL: String!
    accountStatus: DriverAccountStatus!
    dateJoined: String!
    currentBalance: Float!
    totalEarnings: Float!
    totalDistanceTraveled: Float!
    totalAdImpressions: Int!
    installedDeviceId: String
    installedMaterialType: InstalledMaterialType
    deviceStatus: DeviceStatus!
    qrCodeIdentifier: String!
    isEmailVerified: Boolean!
    emailVerificationCode: String
    emailVerificationCodeExpires: String
    lastLogin: String
    preferredMaterialType: [InstalledMaterialType!]
    adminOverride: Boolean
    approvalDate: String
    rejectedReason: String
  }

  type AuthPayload {
  success: Boolean!
  message: String
  token: String
  driver: Driver
}

  type DriverResponse {
    success: Boolean!
    message: String!
    token: String
    driver: Driver
  }

  input CreateDriverInput {
    firstName: String!
    lastName: String!
    contactNumber: String!
    email: String!
    password: String!
    address: String!
    licenseNumber: String!
    licensePictureURL: String!
    vehiclePlateNumber: String!
    vehicleType: String!
    vehicleModel: String!
    vehicleYear: Int!
    vehiclePhotoURL: String!
    orCrPictureURL: String!
    installedMaterialType: InstalledMaterialType
    preferredMaterialType: [InstalledMaterialType!]
  }

  input UpdateDriverInput {
    firstName: String
    lastName: String
    contactNumber: String
    email: String
    password: String
    address: String
    licenseNumber: String
    licensePictureURL: String
    vehiclePlateNumber: String
    vehicleType: String
    vehicleModel: String
    vehicleYear: Int
    vehiclePhotoURL: String
    orCrPictureURL: String
    accountStatus: DriverAccountStatus
    deviceStatus: DeviceStatus
    installedMaterialType: InstalledMaterialType
    preferredMaterialType: [InstalledMaterialType!]
  }

  input ResubmitDriverInput {
    firstName: String
    lastName: String
    contactNumber: String
    email: String
    password: String
    address: String
    licenseNumber: String
    licensePictureURL: String
    vehiclePlateNumber: String
    vehicleType: String
    vehicleModel: String
    vehicleYear: Int
    vehiclePhotoURL: String
    orCrPictureURL: String
    preferredMaterialType: [InstalledMaterialType!]
  }

  type Query {
    getAllDrivers: [Driver!]!
    getDriverById(driverId: ID!): Driver
  }

  type Mutation {
    createDriver(input: CreateDriverInput!): DriverResponse!
    updateDriver(driverId: ID!, input: UpdateDriverInput!): DriverResponse!
    deleteDriver(driverId: ID!): DriverResponse!
    loginDriver(email: String!, password: String!): DriverResponse!
    verifyDriverEmail(code: String!): DriverResponse!
    resendDriverVerificationCode(email: String!): DriverResponse!
    approveDriver(driverId: ID!, materialTypeOverride: [InstalledMaterialType]): DriverResponse!
    rejectDriver(driverId: ID!, reason: String!): DriverResponse!
    resubmitDriver(driverId: ID!, input: ResubmitDriverInput!): DriverResponse!
  }
`;

module.exports = typeDefs;
