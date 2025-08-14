// adsDeploymentSchema.js

const { gql } = require('graphql-tag');

const adsDeploymentTypeDefs = gql`
  enum DeploymentStatus {
    SCHEDULED
    RUNNING
    COMPLETED
    PAUSED
    CANCELLED
    REMOVED
    PAID
  }

  type AdsDeployment {
    id: ID!
    adDeploymentId: String!
    materialId: ID!
    driverId: ID!
    adId: ID!
    startTime: String!
    endTime: String!
    currentStatus: DeploymentStatus!
    lastFrameUpdate: String
    deployedAt: String
    completedAt: String
    removedAt: String
    removedBy: ID
    removalReason: String
    displaySlot: Int
    createdAt: String!
    updatedAt: String!
    
    # Populated fields
    ad: Ad
    material: Material
    driver: Driver
    removedByUser: User
  }

  # For reference - these types should be defined in their respective schema files
  type Material {
    id: ID!
    name: String!
    type: String!
  }

  type Driver {
    id: ID!
    name: String!
    email: String!
  }

  type User {
    id: ID!
    name: String!
    email: String!
  }

  type LCDRemovalResponse {
    success: Boolean!
    message: String!
    removedDeployments: [AdsDeployment!]!
    availableSlots: [Int!]!
  }

  type SlotReassignmentUpdate {
    deploymentId: ID!
    oldSlot: Int
    newSlot: Int!
  }

  type SlotReassignmentResponse {
    success: Boolean!
    message: String!
    updates: [SlotReassignmentUpdate!]!
  }

  input CreateDeploymentInput {
    adId: ID!
    materialId: ID!
    driverId: ID!
    startTime: String!
    endTime: String!
  }

  type Query {
    getAllDeployments: [AdsDeployment!]!
    getDeploymentsByDriver(driverId: ID!): [AdsDeployment!]!
    getDeploymentsByAd(adId: ID!): [AdsDeployment!]!
    getMyAdDeployments: [AdsDeployment!]!
    getActiveDeployments: [AdsDeployment!]!
    getDeploymentById(id: ID!): AdsDeployment
    getLCDDeployments(materialId: ID!): [AdsDeployment!]!
  }

  type Mutation {
    createDeployment(input: CreateDeploymentInput!): AdsDeployment!
    updateDeploymentStatus(id: ID!, status: DeploymentStatus!): AdsDeployment!
    updateFrameTimestamp(id: ID!): AdsDeployment!
    deleteDeployment(id: ID!): Boolean!
    updateDisplaySlot(deploymentId: ID!, slot: Int!): AdsDeployment!
    
    # LCD Override Functions
    removeAdsFromLCD(
      materialId: ID!
      deploymentIds: [ID!]!
      reason: String
    ): LCDRemovalResponse!
    
    reassignLCDSlots(materialId: ID!): SlotReassignmentResponse!
  }
`;

module.exports = adsDeploymentTypeDefs;