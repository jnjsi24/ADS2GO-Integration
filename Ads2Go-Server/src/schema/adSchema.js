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
    userId: User!          
    driverId: ID
    materialId: Material   
    planId: AdsPlan        
    title: String!
    description: String
    adFormat: String!
    mediaFile: String!
    price: Float!          # total price for the ad
    durationDays: Int!     
    numberOfDevices: Int!
    adLengthSeconds: Int!
    playsPerDayPerDevice: Int!
    totalPlaysPerDay: Int!
    pricePerPlay: Float!
    totalPrice: Float!     
    adType: AdType!
    status: AdStatus!
    reasonForReject: String
    approveTime: String
    rejectTime: String
    startTime: String!
    endTime: String!
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
    price: Float!
    status: AdStatus!
    startTime: String!      # user-defined start time
    endTime: String!        # calculated end time based on plan duration
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
    startTime: String      # update start time, auto-adjusts endTime
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
