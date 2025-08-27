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

  enum MaterialType {
    POSTER
    LCD
    STICKER
    HEADDRESS
    BANNER
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
    materialType: MaterialType!
    description: String
    requirements: String
    category: MaterialCategory!
    driverId: String             # stored as system driverId (e.g. DRV-001), not ObjectId
    driver: DriverInfo           # Driver details if assigned
    mountedAt: String
    dismountedAt: String
    createdAt: String
    updatedAt: String
  }

  type MaterialWithDriver {
    material: Material!
    assignedDriver: DriverInfo
  }

  input CreateMaterialInput {
    vehicleType: VehicleType!
    materialType: MaterialType!
    description: String
    requirements: String!
    category: MaterialCategory!
  }

  input UpdateMaterialInput {
    vehicleType: VehicleType
    materialType: MaterialType
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

extend type Query {
  # Admin-only
  getAllMaterials: [Material!]!
  getMaterialById(id: ID!): Material
  
  # Filtered queries (usable by user and driver)
  getMaterialsByCategory(category: MaterialCategory!): [Material!]!
  getMaterialsByVehicleType(vehicleType: VehicleType!): [Material!]!
  getMaterialsByCategoryAndVehicle(category: MaterialCategory!, vehicleType: VehicleType!): [Material!]!

  getMaterialWithDriver(materialId: ID!): MaterialWithDriver
}

  type Mutation {
    # Admin-only
    createMaterial(input: CreateMaterialInput!): Material
    updateMaterial(id: ID!, input: UpdateMaterialInput!): Material
    deleteMaterial(id: ID!): String

    # Material Assignment (Admin-only)
    assignMaterialToDriver(driverId: String!): MaterialAssignmentResult
    unassignMaterialFromDriver(materialId: ID!): MaterialAssignmentResult
  }
`;
