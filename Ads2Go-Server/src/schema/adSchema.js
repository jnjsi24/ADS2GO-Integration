const gql = require('graphql-tag');

const adTypeDefs = gql`
  enum AdStatus {
    PENDING
    APPROVED
    REJECTED
    RUNNING
    ENDED
    PAID
    DEPLOYED
  }

  enum AdType {
    DIGITAL
    NON_DIGITAL
  }

  type Ad {
    id: ID!
    userId: ID!
    driverId: ID
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
    paidTime: String
    deployedTime: String
    createdAt: String!
    updatedAt: String!
    
    # Populated fields
    user: User
    driver: Driver
    material: Material
    plan: AdsPlan
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
    getPaidAds: [Ad!]! # New query for paid ads ready for deployment
    getDeployableAds: [Ad!]! # New query for ads that can be deployed
  }

  type Mutation {
    createAd(input: CreateAdInput!): Ad!
    updateAd(id: ID!, input: UpdateAdInput!): Ad!
    deleteAd(id: ID!): Boolean!
    markAdAsPaid(adId: ID!): Ad! # New mutation to mark ad as paid
    markAdAsDeployed(adId: ID!): Ad! # New mutation to mark ad as deployed
  }
`;

module.exports = adTypeDefs;