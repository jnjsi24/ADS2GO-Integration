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
    price: Float!
    status: AdStatus!
    startTime: String!
    endTime: String!
    adType: AdType!
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
