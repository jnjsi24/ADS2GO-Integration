// adsDeploymentSchema.js

const { gql } = require('graphql-tag');

const adsDeploymentTypeDefs = gql`
  enum DeploymentStatus {
    SCHEDULED
    RUNNING
    COMPLETED
    PAUSED
    CANCELLED
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
    createdAt: String!
    updatedAt: String!
    
    # Populated fields
    ad: Ad
    material: Material
    driver: Driver
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
  }

  type Mutation {
    createDeployment(input: CreateDeploymentInput!): AdsDeployment!
    updateDeploymentStatus(id: ID!, status: DeploymentStatus!): AdsDeployment!
    updateFrameTimestamp(id: ID!): AdsDeployment!
    deleteDeployment(id: ID!): Boolean!
  }
`;

module.exports = adsDeploymentTypeDefs;