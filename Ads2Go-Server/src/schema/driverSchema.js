const gql = require('graphql-tag');

const typeDefs = gql`

  enum DriverAccountStatus {
    PENDING
    ACTIVE
    SUSPENDED
  }

  enum DeviceStatus {
    ONLINE
    OFFLINE
    ERROR
  }

  enum EditRequestStatus {
    NONE
    PENDING
    APPROVED
    REJECTED
  }

  type Driver {
    id: ID!
    driverId: String!
    firstName: String!
    lastName: String!
    contactNumber: String!
    email: String!
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
    deviceStatus: DeviceStatus!
    qrCodeIdentifier: String!
    isEmailVerified: Boolean!
    emailVerificationCode: String
    emailVerificationCodeExpires: String
    lastLogin: String
    editRequestStatus: EditRequestStatus
    editRequestData: EditRequestData
  }

  type DriverResponse {
    success: Boolean!
    message: String!
    driver: Driver
  }

  type AuthPayload {
    token: String!
    driver: Driver!
  }

  type EditRequestData {
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
  }

  input CreateDriverInput {
    driverId: String!
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
    qrCodeIdentifier: String!
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
  }

  input EditDriverRequestInput {
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
  }

  type Query {
    getAllDrivers: [Driver!]!
    getDriverById(id: ID!): Driver
    getDriversWithPendingEdits: [Driver!]!

    # NEW: Get the logged-in driver's own info
    getOwnDriver: Driver
  }

  type Mutation {
    createDriver(input: CreateDriverInput!): DriverResponse!
    updateDriver(id: ID!, input: UpdateDriverInput!): DriverResponse!
    deleteDriver(id: ID!): DriverResponse!

    loginDriver(email: String!, password: String!): AuthPayload!
    verifyDriverEmail(code: String!): DriverResponse!
    resendDriverVerificationCode(email: String!): DriverResponse!

    requestDriverEdit(input: EditDriverRequestInput!): DriverResponse!
    approveDriverEditRequest(id: ID!): DriverResponse!
    rejectDriverEditRequest(id: ID!): DriverResponse!
  }

`;

module.exports = typeDefs;
