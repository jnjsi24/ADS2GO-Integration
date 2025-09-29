const { gql } = require('apollo-server-express');

module.exports = gql`
  type FlexiblePricingCalculation {
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
    availableDevices: Int!
    minAdLengthSeconds: Int!
    maxAdLengthSeconds: Int!
  }

  type FieldCombination {
    id: ID!
    materialType: String!
    vehicleType: String!
    category: String!
    maxDevices: Int!
    minAdLengthSeconds: Int!
    maxAdLengthSeconds: Int!
    isActive: Boolean!
  }

  input FlexibleAdInput {
    title: String!
    description: String!
    website: String
    materialType: String!
    vehicleType: String!
    category: String!
    durationDays: Int!
    adLengthSeconds: Int!
    numberOfDevices: Int!
    adType: String!
    adFormat: String!
    status: String!
    startTime: String!
    endTime: String!
    mediaFile: String!
    price: Float
  }

  type Query {
    getFlexibleFieldCombinations: [FieldCombination!]!
    calculateFlexiblePricing(
      materialType: String!
      vehicleType: String!
      category: String!
      durationDays: Int!
      adLengthSeconds: Int!
      numberOfDevices: Int!
    ): FlexiblePricingCalculation!
  }

  type Mutation {
    createFlexibleAd(input: FlexibleAdInput!): Ad!
  }
`;
