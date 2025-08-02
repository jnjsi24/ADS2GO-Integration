const { gql } = require('apollo-server-express');

module.exports = gql`
  type AdsPlan {
    _id: ID!
    name: String!
    durationDays: Int!
    category: String!
    materialType: String!
    vehicleType: String!
    price: Float!
    description: String
    createdAt: String
    updatedAt: String
  }

  input AdsPlanInput {
    name: String!
    durationDays: Int!
    category: String!
    materialType: String!
    vehicleType: String!
    price: Float!
    description: String
  }

  type Query {
    getAllAdsPlans: [AdsPlan]
    getAdsPlanById(id: ID!): AdsPlan
    getAdsPlansByFilter(category: String, materialType: String, vehicleType: String): [AdsPlan]
  }

  type Mutation {
    createAdsPlan(input: AdsPlanInput!): AdsPlan
    updateAdsPlan(id: ID!, input: AdsPlanInput!): AdsPlan
    deleteAdsPlan(id: ID!): String
  }
`;
