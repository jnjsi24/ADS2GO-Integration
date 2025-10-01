
//adsDeploymentSchema.js

const { gql } = require('graphql-tag');

const adsDeploymentTypeDefs = gql`
  # Deployment Status Enum
  enum DeploymentStatus {
    SCHEDULED
    RUNNING
    COMPLETED
    PAUSED
    CANCELLED
    REMOVED
    PAID
  }

  # LCD Slot type for array storage
  type LCDSlot {
    id: ID!
    adId: ID!
    slotNumber: Int!
    status: DeploymentStatus!
    deployedAt: String
    completedAt: String
    removedAt: String
    removedBy: ID
    removalReason: String
    mediaFile: String!
    
    # Populated field - references existing Ad type
    ad: Ad
  }

  # Main AdsDeployment type
  type AdsDeployment {
    id: ID!
    adDeploymentId: String!
    materialId: ID!
    driverId: ID!
    
    # For single ad deployments (non-LCD)
    adId: ID
    
    # For LCD materials - array of slots
    lcdSlots: [LCDSlot!]!
    
    startTime: String
    endTime: String
    currentStatus: DeploymentStatus!
    lastFrameUpdate: String
    deployedAt: String
    completedAt: String
    removedAt: String
    removedBy: ID
    removalReason: String
    createdAt: String!
    updatedAt: String!
    
    # Populated fields - references existing types
    ad: Ad
    material: Material  
    driver: Driver
    removedByUser: User
  }

  # LCD Management Response Types
  type LCDRemovalResponse {
    success: Boolean!
    message: String!
    removedSlots: [LCDSlot!]!
    availableSlots: [Int!]!
  }

  type SlotReassignmentUpdate {
    adId: ID!
    oldSlot: Int
    newSlot: Int!
  }

  type SlotReassignmentResponse {
    success: Boolean!
    message: String!
    updates: [SlotReassignmentUpdate!]!
  }

  # Input Types
  input CreateDeploymentInput {
    adId: ID!
    materialId: ID!
    driverId: ID!
    startTime: String
    endTime: String
  }

  # Extend existing Query type
  extend type Query {
    # Get all deployments (Admin only)
    getAllDeployments: [AdsDeployment!]!
    
    # Get deployments by driver
    getDeploymentsByDriver(driverId: ID!): [AdsDeployment!]!
    
    # Get deployments containing specific ad
    getDeploymentsByAd(adId: ID!): [AdsDeployment!]!
    
    # Get current user's ad deployments
    getMyAdDeployments: [AdsDeployment!]!
    
    # Get currently running deployments (Admin only)
    getActiveDeployments: [AdsDeployment!]!
    
    # Get deployment by ID
    getDeploymentById(id: ID!): AdsDeployment
    
    # Get LCD slots for specific material
    getLCDDeployments(materialId: ID!): [LCDSlot!]!
    
    # Get available LCD slot numbers for material
    getAvailableLCDSlots(materialId: ID!): [Int!]!
  }

  # Extend existing Mutation type
  extend type Mutation {
    # Create new deployment (works for both LCD and non-LCD)
    createDeployment(input: CreateDeploymentInput!): AdsDeployment!
    
    # Update overall deployment status
    updateDeploymentStatus(id: ID!, status: DeploymentStatus!): AdsDeployment!
    
    # Update specific LCD slot status
    updateLCDSlotStatus(materialId: ID!, adId: ID!, status: DeploymentStatus!): AdsDeployment!
    
    # Update frame timestamp (for driver apps)
    updateFrameTimestamp(id: ID!): AdsDeployment!
    
    # Remove ads from LCD material (Admin only)
    removeAdsFromLCD(
      materialId: ID!
      adIds: [ID!]!
      reason: String
    ): LCDRemovalResponse!
    
    # Reassign LCD slots after removals (Admin only)
    reassignLCDSlots(materialId: ID!): SlotReassignmentResponse!
    
    # Delete deployment (Admin only - only SCHEDULED/CANCELLED)
    deleteDeployment(id: ID!): Boolean!
  }
`;

module.exports = adsDeploymentTypeDefs;



