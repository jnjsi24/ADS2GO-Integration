const { gql } = require('apollo-server-express');

module.exports = gql`
  type AdsPlan {
    _id: ID!
    name: String!
    durationDays: Int!
    category: String!
    materialType: String!
    vehicleType: String!
    numberOfDevices: Int!
    adLengthMinutes: Int!
    playsPerDayPerDevice: Int!
    totalPlaysPerDay: Int!
    pricePerPlay: Float!
    dailyRevenue: Float!
    totalPrice: Float!
    status: String!
    impressions: Int!
    startDate: String
    endDate: String
    description: String!
    currentDurationDays: Int!
    createdAt: String
    updatedAt: String
  }

  input AdsPlanInput {
    name: String!
    durationDays: Int!
    category: String!
    materialType: String!
    vehicleType: String!
    numberOfDevices: Int!
    adLengthMinutes: Int!
    playsPerDayPerDevice: Int!
    pricePerPlay: Float!
    description: String!
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
    updateAdsPlan(id: ID!, input: AdsPlanInput!): AdsPlan
    deleteAdsPlan(id: ID!): String
    startAdsPlan(id: ID!): AdsPlan
    endAdsPlan(id: ID!): AdsPlan
    incrementImpressions(id: ID!): AdsPlan
  }
`;
