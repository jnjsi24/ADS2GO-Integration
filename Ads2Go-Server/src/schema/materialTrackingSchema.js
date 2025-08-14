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

  enum DeviceStatus {
    ONLINE
    OFFLINE
  }

  enum MaterialCondition {
    GOOD
    FADED
    DAMAGED
    REMOVED
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
    deviceStatus: DeviceStatus
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
    materialCondition: MaterialCondition
    inspectionPhotos: [String]
    lastInspectionDate: String
    createdAt: String
    updatedAt: String
  }

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

  type TabletReportResponse {
    tablet: Tablet!
    materialTracking: MaterialTracking!
  }

  input GPSInput {
    lat: Float
    lng: Float
  }

  input TabletReportInput {
    deviceId: String!
    gps: GPSInput
    isOnline: Boolean
    qrCodeScans: Int
    totalAdImpressions: Int
    totalDistanceTraveled: Float
  }

  type Query {
    getMaterialTrackings: [MaterialTracking]
    getMaterialTrackingById(id: ID!): MaterialTracking
  }

  type Mutation {
    createMaterialTracking(input: MaterialTrackingInput!): MaterialTracking
    updateMaterialTracking(id: ID!, input: MaterialTrackingInput!): MaterialTracking
    deleteMaterialTracking(id: ID!): String

    reportTabletData(input: TabletReportInput!): TabletReportResponse
  }

  input MaterialTrackingInput {
    materialId: ID!
    driverId: ID
    deploymentId: ID
    gps: GPSInput
    speed: Float
    totalDistanceTraveled: Float
    lastKnownLocationTime: String
    deviceStatus: DeviceStatus
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
    materialCondition: MaterialCondition
    inspectionPhotos: [String]
    lastInspectionDate: String
  }

  input ErrorLogInput {
    timestamp: String
    message: String
  }
`;

module.exports = typeDefs;
