const { gql } = require('graphql-tag');

module.exports = gql`
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

  enum MaterialTypeEnum {
    POSTER
    LCD
    STICKER
    HEADDRESS
    BANNER
  }

  enum MaterialCondition {
    GOOD
    FADED
    DAMAGED
    REMOVED
  }

  type DriverInfo {
    driverId: String!
    fullName: String!
    email: String!
    contactNumber: String!
    vehiclePlateNumber: String!
  }

  type Material {
    id: ID!
    materialId: String!          # e.g., DGL-0001 or NDGL-0001
    vehicleType: VehicleType!
    materialType: MaterialTypeEnum!
    description: String
    requirements: String
    category: MaterialCategory!
    driverId: String             # stored as system driverId (e.g. DRV-001), not ObjectId
    driver: DriverInfo           # Driver details if assigned
    mountedAt: String
    dismountedAt: String
    createdAt: String
    updatedAt: String
    # Material condition and inspection fields (from materialTracking)
    materialCondition: MaterialCondition
    inspectionPhotos: [InspectionPhoto!]
    photoComplianceStatus: String
    lastInspectionDate: String
    nextInspectionDue: String
  }

  type InspectionPhoto {
    url: String!
    uploadedAt: String!
    uploadedBy: String!
    description: String
    month: String!
    status: String!
  }

  type MaterialWithDriver {
    material: Material!
    assignedDriver: DriverInfo
  }

  input CreateMaterialInput {
    vehicleType: VehicleType!
    materialType: MaterialTypeEnum!
    description: String
    requirements: String!
    category: MaterialCategory!
  }

  input UpdateMaterialInput {
    vehicleType: VehicleType
    materialType: MaterialTypeEnum
    description: String
    requirements: String
    category: MaterialCategory
    driverId: ID
    mountedAt: String
    dismountedAt: String
  }

  type MaterialAssignmentResult {
    success: Boolean!
    message: String!
    material: Material
    driver: DriverInfo
  }

  type MaterialTrackingInfo {
    photoComplianceStatus: String
    nextPhotoDue: String
    lastPhotoUpload: String
    monthlyPhotos: [MonthlyPhoto]
  }

  type MonthlyPhoto {
    month: String!
    status: String!
    photoUrls: [String!]!
    uploadedAt: String!
    uploadedBy: String!
    adminNotes: String
  }

  type MaterialWithTracking {
    id: ID!
    materialId: String!
    materialType: MaterialTypeEnum!
    materialName: String
    description: String
    status: String
    assignedDate: String
    location: LocationInfo
    materialTracking: MaterialTrackingInfo
  }

  type LocationInfo {
    address: String
    coordinates: [Float!]
  }

  type DriverMaterialsResponse {
    success: Boolean!
    message: String!
    materials: [MaterialWithTracking!]!
  }

extend type Query {
  # Admin-only
  getAllMaterials: [Material!]!
  getMaterialById(id: ID!): Material
  
  # Filtered queries (usable by user and driver)
  getMaterialsByCategory(category: MaterialCategory!): [Material!]!
  getMaterialsByVehicleType(vehicleType: VehicleType!): [Material!]!
  getMaterialsByCategoryAndVehicle(category: MaterialCategory!, vehicleType: VehicleType!): [Material!]!
  getMaterialsByCategoryVehicleAndType(category: MaterialCategory!, vehicleType: VehicleType!, materialType: MaterialTypeEnum!): [Material!]!

  getMaterialWithDriver(materialId: ID!): MaterialWithDriver
  
  # Get materials assigned to a specific driver
  getDriverMaterials(driverId: ID!): DriverMaterialsResponse!
}

  type Mutation {
    # Admin-only
    createMaterial(input: CreateMaterialInput!): Material
    updateMaterial(id: ID!, input: UpdateMaterialInput!): Material
    deleteMaterial(id: ID!): String

    # Material Assignment (Admin-only)
    assignMaterialToDriver(driverId: String!, materialId: ID): MaterialAssignmentResult
    unassignMaterialFromDriver(materialId: ID!): MaterialAssignmentResult

    # Driver photo upload
    uploadMonthlyPhoto(materialId: ID!, photoUrls: [String!]!, month: String!, description: String): MaterialPhotoUploadResult
  }

  type MaterialPhotoTracking {
    id: ID!
    materialId: ID!
    driverId: ID
    materialCondition: MaterialCondition
    monthlyPhotos: [MonthlyPhoto!]
    photoComplianceStatus: String
    lastPhotoUpload: String
    nextPhotoDue: String
  }

  type MaterialPhotoUploadResult {
    success: Boolean!
    message: String!
    materialTracking: MaterialPhotoTracking
  }
`;
