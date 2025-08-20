// adSchema.js
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
    id: ID!                # ✅ alias for Mongo _id
    userId: User!          # ✅ relationship
    driverId: ID
    materialId: Material   # ✅ relationship
    planId: AdsPlan!       # ✅ relationship
    title: String!
    description: String
    adFormat: String!
    mediaFile: String!
    price: Float!          # ✅ Calculated from plan and duration
    rejectReason: String

    # Plan-related fields
    numberOfDevices: Int!
    adLengthMinutes: Int!
    playsPerDayPerDevice: Int!
    totalPlaysPerDay: Int!
    pricePerPlay: Float!
    totalPrice: Float!     # ✅ Calculated: totalPlaysPerDay * pricePerPlay * duration in days

    status: AdStatus!
    startTime: String!
    endTime: String!
    adType: AdType!
    durationType: AdDurationType!
    reasonForReject: String
    approveTime: String
    rejectTime: String
    createdAt: String!
    updatedAt: String!
  }

  input CreateAdInput {
    driverId: ID
    materialId: ID!
    planId: ID!
    title: String!
    description: String
    adFormat: String!
    mediaFile: String!
    startTime: String!
    adType: AdType!
    durationType: AdDurationType! # ✅ used for price & endTime calculation
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
    durationType: AdDurationType
    rejectReason: String
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
