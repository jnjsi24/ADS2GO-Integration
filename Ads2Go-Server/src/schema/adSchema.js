const gql = require('graphql-tag');

const adTypeDefs = gql`
  enum AdStatus {
    PENDING
    APPROVED
    REJECTED
    RUNNING
    ENDED
  }

  enum AdType {
    DIGITAL
    NON_DIGITAL
  }

  enum AdDurationType {
    WEEKLY
    MONTHLY
    YEARLY
  }

  type Ad {
    id: ID!
    userId: ID!
    riderId: ID
    materialId: ID!
    planId: ID!
    title: String!
    description: String
    adFormat: String!
    mediaFile: String!
    price: Float! # ✅ Calculated from plan and duration

    # Plan-related fields
    numberOfDevices: Int!
    adLengthMinutes: Int!
    playsPerDayPerDevice: Int!
    totalPlaysPerDay: Int!
    pricePerPlay: Float!
    totalPrice: Float! # ✅ Calculated as totalPlaysPerDay * pricePerPlay * duration in days

    status: AdStatus!
    startTime: String!
    endTime: String!
    adType: AdType!
    durationType: AdDurationType! # ✅ Duration of ad (weekly, monthly, yearly)
    reasonForReject: String
    approveTime: String
    rejectTime: String
    createdAt: String!
    updatedAt: String!
  }

  input CreateAdInput {
    riderId: ID
    materialId: ID!
    planId: ID!
    title: String!
    description: String
    adFormat: String!
    mediaFile: String!
    startTime: String!
    adType: AdType!
    durationType: AdDurationType! # ✅ Must pass duration to calculate price and endTime
  }

  input UpdateAdInput {
    title: String
    description: String
    adFormat: String
    mediaFile: String
    materialId: ID
    planId: ID
    status: AdStatus
    startTime: String
    adType: AdType
    durationType: AdDurationType # ✅ Optional update to recalc price/endTime
    reasonForReject: String
  }

  type Query {
    getAllAds: [Ad!]!
    getAdById(id: ID!): Ad
    getAdsByUser(userId: ID!): [Ad!]!
    getMyAds: [Ad!]!
  }

  type Mutation {
    createAd(input: CreateAdInput!): Ad!
    updateAd(id: ID!, input: UpdateAdInput!): Ad!
    deleteAd(id: ID!): Boolean!
  }
`;

module.exports = adTypeDefs;
