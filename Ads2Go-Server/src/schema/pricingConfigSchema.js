const { gql } = require('apollo-server-express');

module.exports = gql`
  type PricingTier {
    durationDays: Int!
    pricePerPlay: Float!
    adLengthMultiplier: Float
  }

  type PricingConfig {
    id: ID!
    materialType: String!
    vehicleType: String!
    category: String!
    pricingTiers: [PricingTier!]!
    maxDevices: Int!
    minAdLengthSeconds: Int!
    maxAdLengthSeconds: Int!
    isActive: Boolean!
    createdBy: String!
    createdAt: String!
    updatedAt: String!
  }

  input PricingTierInput {
    durationDays: Int!
    pricePerPlay: Float!
    adLengthMultiplier: Float
  }

  input PricingConfigInput {
    materialType: String!
    vehicleType: String!
    category: String!
    pricingTiers: [PricingTierInput!]!
    maxDevices: Int!
    minAdLengthSeconds: Int
    maxAdLengthSeconds: Int
    isActive: Boolean
  }

  input PricingConfigUpdateInput {
    pricingTiers: [PricingTierInput!]
    maxDevices: Int
    minAdLengthSeconds: Int
    maxAdLengthSeconds: Int
    isActive: Boolean
  }

  type PricingCalculation {
    materialType: String!
    vehicleType: String!
    category: String!
    durationDays: Int!
    adLengthSeconds: Int!
    numberOfDevices: Int!
    pricePerPlay: Float!
    playsPerDayPerDevice: Int!
    totalPlaysPerDay: Int!
    dailyRevenue: Float!
    totalPrice: Float!
    maxDevices: Int!
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
      durationDays: Int!
      adLengthSeconds: Int!
      numberOfDevices: Int!
    ): PricingCalculation
  }

  type Mutation {
    createPricingConfig(input: PricingConfigInput!): PricingConfig!
    updatePricingConfig(id: ID!, input: PricingConfigUpdateInput!): PricingConfig!
    deletePricingConfig(id: ID!): String!
    togglePricingConfigStatus(id: ID!): PricingConfig!
  }
`;

