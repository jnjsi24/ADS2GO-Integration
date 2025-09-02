const gql = require('graphql-tag');

const typeDefs = gql`
  """
  SCALARS
  """
  scalar Upload

  """
  ENUMS
  """
  enum DriverAccountStatus {
    PENDING
    ACTIVE
    SUSPENDED
    REJECTED
    RESUBMITTED
  }

  enum InstalledMaterialType {
    LCD
    BANNER
    HEADDRESS
    STICKER
  }

  enum MaterialTypeEnum {
    LCD
    BANNER
    STICKER
    HEADDRESS
    POSTER
  }

  enum MaterialCategory {
    DIGITAL
    NON_DIGITAL
  }

  enum VehicleType {
    CAR
    MOTORCYCLE
    BUS
    JEEP
    E_TRIKE
  }

  """
  TYPES
  """
  type MaterialInfo {
    id: ID!
    materialId: String!
    materialType: MaterialTypeEnum!
    category: MaterialCategory!
    description: String
    requirements: String
    vehicleType: VehicleType!
    mountedAt: String
    dismountedAt: String
  }

  type EditRequestData {
    firstName: String
    middleName: String
    lastName: String
    contactNumber: String
    email: String
    address: String
    profilePicture: String
    licenseNumber: String
    licensePictureURL: String
    vehiclePlateNumber: String
    vehicleType: VehicleType
    vehicleModel: String
    vehicleYear: Int
    vehiclePhotoURL: String
    orCrPictureURL: String
    preferredMaterialType: [MaterialTypeEnum!]
    reason: String
  }

  type Driver {
    id: ID!
    driverId: String!
    materialId: String
    reviewStatus: String
    firstName: String!
    middleName: String
    lastName: String!
    fullName: String!
    contactNumber: String!
    email: String!
    address: String
    licenseNumber: String
    licensePictureURL: String
    vehiclePlateNumber: String
    vehicleType: VehicleType!
    vehicleModel: String
    vehicleYear: Int
    vehiclePhotoURL: String
    orCrPictureURL: String
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
    preferredMaterialType: [MaterialTypeEnum!]!
    adminOverrideMaterialType: InstalledMaterialType
    adminOverride: Boolean
    approvalDate: String
    rejectedReason: String
    editRequestStatus: String
    editRequestData: EditRequestData
    profilePicture: String
    material: MaterialInfo   # Reference to assigned material
    createdAt: String
    updatedAt: String
  }

  type DriverWithMaterial {
    driver: Driver!
    assignedMaterial: MaterialInfo
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

  type LoginDriverPayload {
    success: Boolean!
    message: String!
    token: String
    driver: Driver
  }

  type Response {
    success: Boolean!
    message: String!
  }

  type DriverMutationResponse {
    success: Boolean!
    message: String!
    driver: Driver
  }

  # NEW PASSWORD RESET RESPONSE TYPE
  type PasswordResetResponse {
    success: Boolean!
    message: String!
  }

  """
  INPUTS
  """
  input DeviceInfoInput {
    deviceId: String!
    deviceType: String!
    deviceName: String!
  }

  input DriverInput {
    firstName: String!
    middleName: String
    lastName: String!
    contactNumber: String!
    email: String!
    password: String!
    address: String!
    licenseNumber: String!
    licensePicture: Upload  # Changed from String to Upload
    vehiclePlateNumber: String!
    vehicleType: VehicleType!
    vehicleModel: String!
    vehicleYear: Int!
    vehiclePhoto: Upload    # Changed from String to Upload
    orCrPicture: Upload     # Changed from String to Upload
    preferredMaterialType: [MaterialTypeEnum!]!
    profilePicture: Upload  # Changed from String to Upload
  }

  input DriverEditInput {
    firstName: String
    middleName: String
    lastName: String
    contactNumber: String
    email: String
    address: String
    profilePicture: Upload  # Changed from String to Upload
    licenseNumber: String
    licensePicture: Upload  # Changed from String to Upload
    vehiclePlateNumber: String
    vehicleType: VehicleType
    vehicleModel: String
    vehicleYear: Int
    vehiclePhoto: Upload    # Changed from String to Upload
    orCrPicture: Upload     # Changed from String to Upload
    preferredMaterialType: [MaterialTypeEnum!]
    reason: String!
  }

  input UpdateDriverInput {
    firstName: String
    middleName: String
    lastName: String
    contactNumber: String
    email: String
    password: String
    address: String
    licenseNumber: String
    licensePictureURL: String
    vehiclePlateNumber: String
    vehicleType: VehicleType
    vehicleModel: String
    vehicleYear: Int
    vehiclePhotoURL: String
    orCrPictureURL: String
    accountStatus: DriverAccountStatus
    installedMaterialType: InstalledMaterialType
    preferredMaterialType: [MaterialTypeEnum!]
    profilePicture: String
  }

  input ResubmitDriverInput {
    firstName: String
    middleName: String
    lastName: String
    contactNumber: String
    email: String
    password: String
    address: String
    licenseNumber: String
    licensePicture: Upload  # Changed from String to Upload
    vehiclePlateNumber: String
    vehicleType: VehicleType
    vehicleModel: String
    vehicleYear: Int
    vehiclePhoto: Upload    # Changed from String to Upload
    orCrPicture: Upload     # Changed from String to Upload
    preferredMaterialType: [MaterialTypeEnum!]
    profilePicture: Upload  # Changed from String to Upload
  }

  input DriverEditRequestInput {
    firstName: String
    middleName: String
    lastName: String
    contactNumber: String
    email: String
    address: String
    profilePicture: Upload  # Changed from String to Upload
    licenseNumber: String
    licensePicture: Upload  # Changed from String to Upload
    vehiclePlateNumber: String
    vehicleType: VehicleType
    vehicleModel: String
    vehicleYear: Int
    vehiclePhoto: Upload    # Changed from String to Upload
    orCrPicture: Upload     # Changed from String to Upload
    preferredMaterialType: [MaterialTypeEnum!]
    reason: String!
  }

  """
  QUERIES
  """
  type Query {
    getAllDrivers: [Driver!]!
    getDriverById(driverId: ID!): Driver
    getDriver(driverId: ID!): DriverResponse!
    getPendingDrivers: [Driver!]!
    getDriversWithPendingEdits: [Driver!]!
    getDriverWithMaterial(driverId: ID!): DriverWithMaterial
  }

  """
  MUTATIONS
  """
  type Mutation {
    createDriver(input: DriverInput!): DriverResponse!
    updateDriver(driverId: ID!, input: UpdateDriverInput!): DriverResponse!
    deleteDriver(driverId: ID!): DriverResponse!

    loginDriver(email: String!, password: String!, deviceInfo: DeviceInfoInput!): LoginDriverPayload!
    verifyDriverEmail(code: String!): DriverResponse!
    resendDriverVerificationCode(email: String!): Response!
    resetDriverPassword(email: String!, newPassword: String!): Response!

    # NEW PASSWORD RESET MUTATIONS
    requestDriverPasswordReset(email: String!): PasswordResetResponse!
    resetDriverPasswordWithCode(token: String!, newPassword: String!): PasswordResetResponse!

    """
    Approve a driver's account and optionally assign a material type
    """
    approveDriver(
      "The ID of the driver to approve"
      driverId: ID!
      
      "Optional: Override the driver's preferred material types"
      materialTypeOverride: [MaterialTypeEnum!]
    ): DriverMutationResponse!

    rejectDriver(driverId: ID!, reason: String!): DriverResponse!
    resubmitDriver(driverId: ID!, input: ResubmitDriverInput!): DriverResponse!

    unassignAndReassignMaterials(driverId: ID!): DriverResponseWithMaterials!

    approveDriverEditRequest(id: ID!): ApproveDriverEditResponse!
    rejectDriverEditRequest(id: ID!, reason: String): ApproveDriverEditResponse!
    requestDriverEdit(input: DriverEditRequestInput!): ApproveDriverEditResponse!
  }
`;

module.exports = typeDefs;