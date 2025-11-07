const gql = require('graphql-tag');

const adTypeDefs = gql`
  enum AdStatus {
    PENDING
    APPROVED
    REJECTED
    SCHEDULED
    RUNNING
    ENDED
    CANCELLED
    ARCHIVED
  }

  enum AdType {
    DIGITAL
    NON_DIGITAL
  }

  type FlexiblePricingCalculation {
    materialType: String!
    vehicleType: String!
    category: String!
    durationDays: Int!
    durationMonths: Float!
    adLengthSeconds: Int!
    numberOfDevices: Int!
    basePrice: Float!
    adLengthMultiplier: Float!
    durationDiscountMultiplier: Float!
    subtotal: Float!
    discount: Float!
    totalPrice: Float!
    availableDevices: Int!
    devicesWithDriver: Int!
    devicesMounted: Int!
    minAdLengthSeconds: Int!
    maxAdLengthSeconds: Int!
  }

  type FieldCombination {
    id: ID!
    materialType: String!
    vehicleType: String!
    category: String!
    minAdLengthSeconds: Int!
    maxAdLengthSeconds: Int!
    isActive: Boolean!
  }

  input FlexibleAdInput {
    title: String!
    description: String!
    website: String!
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

  type Ad {
    id: ID!                
    userId: User!          
    driverId: ID
    materialId: [Material!]   # Array of materials where this ad is deployed
    targetDevices: [Material!]  # Array of devices where this ad should be deployed
    title: String!
    description: String
    website: String!       # Required advertiser website
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
    adStatus: String!      # INACTIVE, ACTIVE, FINISHED
    paymentStatus: String # PENDING, PAID, FAILED (nullable)
    impressions: Int!
    reasonForReject: String
    approveTime: String
    rejectTime: String
    startTime: String!     # Admin review time (7 days earlier)
    endTime: String!
    userDesiredStartTime: String # User's desired start time
    # Flexible ad fields
    materialType: String
    vehicleType: String
    category: String
    createdAt: String!
    updatedAt: String!
    # Archive fields (30-day deferred deletion)
    isArchived: Boolean!
    archivedAt: String
    scheduledDeletionDate: String
    # Admin tracking fields
    approvedBy: Admin
    rejectedBy: Admin
    deletedBy: Admin
    restoredBy: Admin
  }

  input CreateAdInput {
    driverId: ID
    materialId: [ID!]!
    title: String!
    description: String
    website: String!        # Required advertiser website
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
    materialId: [ID]
    status: AdStatus
    startTime: String      # update start time, auto-adjusts endTime
    adType: AdType
    reasonForReject: String
    adLengthSeconds: Int
    durationDays: Int
    numberOfDevices: Int
    price: Float
    materialType: String
    vehicleType: String
    category: String
  }

  type Query {
    getAllAds(includeArchived: Boolean): [Ad!]!
    getAdById(id: ID!): Ad
    getAdsByUser(userId: ID!): [Ad!]!
    getMyAds: [Ad!]!
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
    createAd(input: CreateAdInput!): Ad! # Deprecated - not used, kept for schema compatibility
    createFlexibleAd(input: FlexibleAdInput!): Ad!
    updateAd(id: ID!, input: UpdateAdInput!): Ad!
    deleteAd(id: ID!): Boolean!
    restoreAd(id: ID!): Boolean!
  }
`;

module.exports = adTypeDefs;
