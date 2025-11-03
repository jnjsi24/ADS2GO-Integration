const { gql } = require('apollo-server-express');

module.exports = gql`
  type PricingConfig {
    id: ID!
    materialType: String!
    vehicleType: String!
    category: String!
    basePrice: Float!
    minAdLengthSeconds: Int!
    maxAdLengthSeconds: Int!
    isActive: Boolean!
    createdBy: String!
    createdAt: String!
    updatedAt: String!
  }

  input PricingConfigInput {
    materialType: String!
    vehicleType: String!
    category: String!
    basePrice: Float!
    minAdLengthSeconds: Int
    maxAdLengthSeconds: Int
    isActive: Boolean
  }

  input PricingConfigUpdateInput {
    basePrice: Float
    minAdLengthSeconds: Int
    maxAdLengthSeconds: Int
    isActive: Boolean
  }

  type PricingCalculation {
    materialType: String!
    vehicleType: String!
    category: String!
    basePrice: Float!
    adLengthSeconds: Int!
    durationMonths: Int!
    numberOfVehicles: Int!
    adLengthMultiplier: Float!
    durationDiscountMultiplier: Float!
    subtotal: Float!
    discount: Float!
    totalPrice: Float!
    minAdLengthSeconds: Int!
    maxAdLengthSeconds: Int!
  }

  type Query {
    getAllPricingConfigs: [PricingConfig!]!
    getPricingConfigById(id: ID!): PricingConfig
    getPricingConfig(
      materialType: String!
      vehicleType: String!
      category: String!
    ): PricingConfig
    calculatePricingConfig(
      materialType: String!
      vehicleType: String!
      category: String!
      durationMonths: Int!
      adLengthSeconds: Int!
      numberOfVehicles: Int!
    ): PricingCalculation
  }

  type Mutation {
    createPricingConfig(input: PricingConfigInput!): PricingConfig!
    updatePricingConfig(id: ID!, input: PricingConfigUpdateInput!): PricingConfig!
    deletePricingConfig(id: ID!): String!
    togglePricingConfigStatus(id: ID!): PricingConfig!
  }
`;

