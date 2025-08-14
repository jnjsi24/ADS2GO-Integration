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

  type QRScan {
    qrCode: String!
    scannedAt: String!
  }

  type Impression {
    materialId: String!
    videoId: String!
    viewedAt: String!
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

  input TabletReportInput {
    deviceId: String!
    gps: GPSInput
    qrScan: QRScanInput
    impression: ImpressionInput
  }

  input GPSInput {
    lat: Float
    lng: Float
  }

  input QRScanInput {
    qrCode: String!
    scannedAt: String!
  }

  input ImpressionInput {
    materialId: String!
    videoId: String!
    viewedAt: String!
  }

  type TabletReportResponse {
    success: Boolean!
    message: String!
  }

  extend type Query {
    getTablet(deviceId: String!): Tablet
    getTabletsByMaterial(materialId: String!): [Tablet]
    getAllTablets: [Tablet]
  }

  extend type Mutation {
    registerTablet(input: RegisterTabletInput!): Tablet
    updateTabletStatus(input: UpdateTabletStatusInput!): Tablet
    reportTabletData(input: TabletReportInput!): TabletReportResponse!
  }
`;
