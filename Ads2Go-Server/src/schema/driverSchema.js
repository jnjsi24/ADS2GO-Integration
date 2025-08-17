

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

  enum InstalledMaterialType {
    LCD
    BANNER
    HEADDRESS
    STICKER
  }

  type EditRequestData {
    firstName: String
    lastName: String
    contactNumber: String
    address: String
  }

  type Driver {
    id: ID!
    driverId: String!
    reviewStatus: String
    firstName: String!
    lastName: String!
    contactNumber: String!
    email: String!
    verified: Boolean!
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
    installedDeviceId: String
    installedMaterialType: InstalledMaterialType
    qrCodeIdentifier: String!
    isEmailVerified: Boolean
    emailVerificationCode: String
    emailVerificationCodeExpires: String
    lastLogin: String
    preferredMaterialType: [InstalledMaterialType!]
    adminOverrideMaterialType: InstalledMaterialType
    adminOverride: Boolean
    approvalDate: String
    rejectedReason: String
    editRequestStatus: String
    editRequestData: EditRequestData
  }

  type MaterialInfo {
    id: ID!
    materialType: InstalledMaterialType!
    vehicleType: String!
    newDriverId: String
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

  type DriverResponseWithMaterials {
    success: Boolean!
    message: String!
    token: String
    driver: Driver
    reassignedMaterials: [MaterialInfo!]
  }

  type ApproveDriverEditResponse {
    success: Boolean!
    message: String!
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

  input DriverEditRequestInput {
    firstName: String
    lastName: String
    contactNumber: String
    address: String
  }

  type Query {
    getAllDrivers: [Driver!]!
    getDriverById(driverId: ID!): Driver
    getDriversWithPendingEdits: [Driver!]!
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
    unassignAndReassignMaterials(driverId: ID!): DriverResponseWithMaterials!
    approveDriverEditRequest(id: ID!): ApproveDriverEditResponse!
    rejectDriverEditRequest(id: ID!, reason: String): ApproveDriverEditResponse!
    requestDriverEdit(input: DriverEditRequestInput!): ApproveDriverEditResponse!
  }
`;

module.exports = typeDefs;



