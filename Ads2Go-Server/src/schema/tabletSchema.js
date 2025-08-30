const { gql } = require('apollo-server-express');

module.exports = gql`
  type TabletUnit {
    tabletNumber: Int!
    status: String!
    gps: GPS
    lastSeen: String
  }

  type Tablet {
    id: ID!
    materialId: ID!
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
  }

  extend type Mutation {
    registerTablet(input: RegisterTabletInput!): Tablet
    updateTabletStatus(input: UpdateTabletStatusInput!): Tablet
  }
`;


