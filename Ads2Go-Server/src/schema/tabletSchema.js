const { gql } = require('apollo-server-express');

module.exports = gql`
  type TabletUnit {
    tabletNumber: Int!
    deviceId: String
    status: String!
    gps: GPS
    lastSeen: String
  }

  type Tablet {
    id: ID!
    materialId: String!  # Changed from ID! to String! to match the model
    carGroupId: String!
    tablets: [TabletUnit!]!
    createdAt: String
    updatedAt: String
  }

  type GPS {
    lat: Float
    lng: Float
  }

  input RegisterTabletInput {
    deviceId: String!
    materialId: String!
    role: String!
  }

  input UpdateTabletStatusInput {
    deviceId: String!
    gps: GPSInput
    isOnline: Boolean
  }

  input GPSInput {
    lat: Float
    lng: Float
  }

  extend type Query {
    getTablet(deviceId: String!): Tablet
    getTabletsByMaterial(materialId: String!): [Tablet]
    getAllTablets: [Tablet]
    getTabletConnectionStatus(materialId: String!, slotNumber: Int!): TabletConnectionStatus
  }

  extend type Mutation {
    registerTablet(input: RegisterTabletInput!): Tablet
    updateTabletStatus(input: UpdateTabletStatusInput!): Tablet
    unregisterTablet(input: UnregisterTabletInput!): UnregisterTabletResponse
    createTabletConfiguration(input: CreateTabletConfigurationInput!): CreateTabletConfigurationResponse
  }

  type TabletConnectionStatus {
    isConnected: Boolean!
    connectedDevice: ConnectedDevice
    materialId: String!
    slotNumber: Int!
    carGroupId: String
  }

  type ConnectedDevice {
    deviceId: String!
    status: String!
    lastSeen: String
    gps: GPS
  }

  input UnregisterTabletInput {
    materialId: String!
    slotNumber: Int!
    carGroupId: String!
  }

  type UnregisterTabletResponse {
    success: Boolean!
    message: String!
  }

  input CreateTabletConfigurationInput {
    materialId: String!
    carGroupId: String!
  }

  type CreateTabletConfigurationResponse {
    success: Boolean!
    message: String!
    tablet: Tablet
  }
`;


