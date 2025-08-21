const { gql } = require('apollo-server-express');

module.exports = gql`
  type AdsPlan {
    id: ID!
    name: String!
    durationDays: Int!
    category: String!
    materialType: String!
    vehicleType: String!
    numberOfDevices: Int!
    adLengthSeconds: Int!
    playsPerDayPerDevice: Int!
    totalPlaysPerDay: Int!
    pricePerPlay: Float!
    dailyRevenue: Float!
    totalPrice: Float!
    status: String!
    startDate: String
    endDate: String
    description: String!
    currentDurationDays: Int!
    createdAt: String
    updatedAt: String
  }

  input AdsPlanInput {
    name: String!
    description: String!
    durationDays: Int!
    category: String!
    materialType: String!
    vehicleType: String!
    numberOfDevices: Int!
    adLengthSeconds: Int!
    playsPerDayPerDevice: Int
    pricePerPlay: Float
    deviceCostOverride: Int
    durationCostOverride: Int
    adLengthCostOverride: Int
  }

  # 👇 New: Update input with all optional fields
  input AdsPlanUpdateInput {
    name: String
    description: String
    durationDays: Int
    category: String
    materialType: String
    vehicleType: String
    numberOfDevices: Int
    adLengthSeconds: Int
    playsPerDayPerDevice: Int
    pricePerPlay: Float
    deviceCostOverride: Int
    durationCostOverride: Int
    adLengthCostOverride: Int
  }

  type Query {
    getAllAdsPlans: [AdsPlan]
    getAdsPlanById(id: ID!): AdsPlan
    getAdsPlansByFilter(
      category: String, 
      materialType: String, 
      vehicleType: String, 
      numberOfDevices: Int, 
      status: String
    ): [AdsPlan]
  }

  type Mutation {
    createAdsPlan(input: AdsPlanInput!): AdsPlan
    updateAdsPlan(id: ID!, input: AdsPlanUpdateInput!): AdsPlan
    deleteAdsPlan(id: ID!): String
    startAdsPlan(id: ID!): AdsPlan
    endAdsPlan(id: ID!): AdsPlan
  }
`;
