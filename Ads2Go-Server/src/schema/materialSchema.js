const { gql } = require('graphql-tag'); 

module.exports = gql`
  type AdvertisementAssignment {
    advertisementId: ID!
    assignedAt: String
    removedAt: String
  }

  type Material {
    _id: ID!
    name: String!
    category: String!
    status: String!
    riderId: ID!
    advertisements: [AdvertisementAssignment]
    createdAt: String
    updatedAt: String
  }

  input AdvertisementInput {
    advertisementId: ID!
    assignedAt: String
    removedAt: String
  }

  input CreateMaterialInput {
    name: String!
    category: String!
    status: String
    riderId: ID!
    advertisements: [AdvertisementInput]
  }

  type Query {
    getAllMaterials: [Material]
    getMaterialById(id: ID!): Material
  }

  type Mutation {
    createMaterial(input: CreateMaterialInput!): Material
    addAdvertisementToMaterial(materialId: ID!, ad: AdvertisementInput!): Material
    deleteMaterial(id: ID!): String
  }
`;
