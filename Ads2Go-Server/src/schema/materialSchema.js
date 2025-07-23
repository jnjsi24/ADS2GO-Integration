const { gql } = require('graphql-tag');

module.exports = gql`
  enum MaterialCategory {
    DIGITAL
    NON_DIGITAL
  }

  type Material {
    id: ID!
    name: String!
    description: String
    requirements: String
    category: MaterialCategory!
    price: Float!
    createdAt: String
    updatedAt: String
  }

  input CreateMaterialInput {
    name: String!
    description: String
    requirements: String
    category: MaterialCategory!
    price: Float!
  }

  input UpdateMaterialInput {
    name: String
    description: String
    requirements: String
    category: MaterialCategory
    price: Float
  }

  extend type Query {
    getAllMaterials: [Material!]!
    getMaterialById(id: ID!): Material
    getMaterialsByCategory(category: String!): [Material!]!
  }

  type Mutation {
    createMaterial(input: CreateMaterialInput!): Material
    updateMaterial(id: ID!, input: UpdateMaterialInput!): Material
    deleteMaterial(id: ID!): String
  }
`;
