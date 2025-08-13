// src/schemas/MaterialTrackingSchema.js
const gql = require('graphql-tag');

const typeDefs = gql`
  type GPS {
    lat: Float
    lng: Float
  }

  type ErrorLog {
    timestamp: String
    message: String
  }

  type MaterialTracking {
    id: ID!
    materialId: ID!
    driverId: ID
    deploymentId: ID
    gps: GPS
    speed: Float
    totalDistanceTraveled: Float
    lastKnownLocationTime: String
    deviceStatus: String
    lastHeartbeat: String
    currentAdId: ID
    adStartTime: String
    adLoopCount: Int
    totalAdImpressions: Int
    totalViewCount: Int
    averageViewTime: Float
    qrCodeScans: Int
    interactions: Int
    uptimePercentage: Float
    lastMaintenanceDate: String
    errorLogs: [ErrorLog]
    materialCondition: String
    inspectionPhotos: [String]
    lastInspectionDate: String
    createdAt: String
    updatedAt: String
  }

  input GPSInput {
    lat: Float
    lng: Float
  }

  input ErrorLogInput {
    timestamp: String
    message: String
  }

  input MaterialTrackingInput {
    materialId: ID!
    driverId: ID
    deploymentId: ID
    gps: GPSInput
    speed: Float
    totalDistanceTraveled: Float
    lastKnownLocationTime: String
    deviceStatus: String
    lastHeartbeat: String
    currentAdId: ID
    adStartTime: String
    adLoopCount: Int
    totalAdImpressions: Int
    totalViewCount: Int
    averageViewTime: Float
    qrCodeScans: Int
    interactions: Int
    uptimePercentage: Float
    lastMaintenanceDate: String
    errorLogs: [ErrorLogInput]
    materialCondition: String
    inspectionPhotos: [String]
    lastInspectionDate: String
  }

  type Query {
    getMaterialTrackings: [MaterialTracking]
    getMaterialTrackingById(id: ID!): MaterialTracking
  }

  type Mutation {
    createMaterialTracking(input: MaterialTrackingInput!): MaterialTracking
    updateMaterialTracking(id: ID!, input: MaterialTrackingInput!): MaterialTracking
    deleteMaterialTracking(id: ID!): String
  }
`;

module.exports = typeDefs;
