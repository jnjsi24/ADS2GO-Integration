const { gql } = require('apollo-server-express');

module.exports = gql`
  type Tablet {
    id: ID!
    deviceId: String!
    materialId: String!
    role: String!
    gps: GPS
    isOnline: Boolean
    lastOnlineAt: String
    lastReportedAt: String
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


