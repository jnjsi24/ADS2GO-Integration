const gql = require('graphql-tag');

const adTypeDefs = gql`
  enum AdStatus {
    PENDING
    APPROVED
    REJECTED
    RUNNING
    ENDED
  }

  type Ad {
    id: ID!
    userId: ID!
    riderId: ID
    materialsId: ID
    title: String!
    description: String
    vehicleType: String!
    materialsUsed: String!
    adFormat: String!
    mediaFile: String!
    plan: String!
    price: Float!
    status: AdStatus!
    startTime: String!
    createdAt: String!
    updatedAt: String!
  }

  input CreateAdInput {
    riderId: ID
    materialsId: ID
    title: String!
    description: String
    vehicleType: String!
    materialsUsed: String!
    adFormat: String!
    mediaFile: String!
    plan: String!
    price: Float!
    startTime: String!
  }

  input UpdateAdInput {
    title: String
    description: String
    vehicleType: String
    materialsUsed: String
    adFormat: String
    mediaFile: String
    plan: String
    price: Float
    status: AdStatus
    startTime: String
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
