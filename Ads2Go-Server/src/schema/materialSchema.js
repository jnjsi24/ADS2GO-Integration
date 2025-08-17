
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

  type Material {
    id: ID!
    materialId: String!          # Always generated automatically (e.g., DGL-0001 or NDGL-0001)
    vehicleType: VehicleType!
    materialType: MaterialType!
    description: String
    requirements: String
    category: MaterialCategory!
    driverId: String             # ✅ Make this String since you’re using "DRV-009"
    mountedAt: String
    dismountedAt: String
    createdAt: String
    updatedAt: String
  }

  input CreateMaterialInput {
    vehicleType: VehicleType!
    materialType: MaterialType!
    description: String
    requirements: String
    category: MaterialCategory!   # Determines prefix: DGL for DIGITAL, NDGL for NON_DIGITAL
  }

  input UpdateMaterialInput {
    vehicleType: VehicleType
    materialType: MaterialType
    description: String
    requirements: String
    category: MaterialCategory
    mountedAt: String
    dismountedAt: String
    driverId: String              # ✅ allow updating driver assignment here too
  }

  extend type Query {
    getAllMaterials: [Material!]!
    getMaterialById(id: ID!): Material
    getMaterialsByCategory(category: MaterialCategory!): [Material!]!
  }

  type Mutation {
    createMaterial(input: CreateMaterialInput!): Material
    updateMaterial(id: ID!, input: UpdateMaterialInput!): Material
    deleteMaterial(id: ID!): String

    assignMaterialToDriver(materialId: ID!, driverId: String!): Material  # ✅ FIXED
  }
`;




