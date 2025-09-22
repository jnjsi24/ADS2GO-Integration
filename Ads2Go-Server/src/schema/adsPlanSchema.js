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
    materials: [Material!]!
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
    pricePerPlay: Float!  # Required - super admin must set this
    # Scheduling fields
    status: String
    startDate: String
    endDate: String
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
    # Scheduling fields
    status: String
    startDate: String
    endDate: String
  }

  type MaterialAvailability {
    materialId: ID!
    materialInfo: Material!
    totalSlots: Int!
    occupiedSlots: Int!
    availableSlots: Int!
    nextAvailableDate: String
    allSlotsFreeDate: String
    status: String!
    canAcceptAd: Boolean!
  }

  type PlanAvailability {
    canCreate: Boolean!
    plan: AdsPlan!
    materialAvailabilities: [MaterialAvailability!]!
    totalAvailableSlots: Int!
    availableMaterialsCount: Int!
    nextAvailableDate: String
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
    getPlanAvailability(planId: ID!, desiredStartDate: String!): PlanAvailability!
    getMaterialsAvailability(materialIds: [ID!]!): [MaterialAvailability!]!
    getAvailabilitySummary: String!
  }

  type Mutation {
    createAdsPlan(input: AdsPlanInput!): AdsPlan
    updateAdsPlan(id: ID!, input: AdsPlanUpdateInput!): AdsPlan
    deleteAdsPlan(id: ID!): String
    startAdsPlan(id: ID!): AdsPlan
    endAdsPlan(id: ID!): AdsPlan
  }
`;
