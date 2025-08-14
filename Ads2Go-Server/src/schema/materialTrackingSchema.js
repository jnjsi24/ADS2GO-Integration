// src/schemas/MaterialTrackingSchema.js
const gql = require('graphql-tag');

const typeDefs = gql`
  """
  Geographic coordinates of the tracked material.
  """
  type GPS {
    lat: Float
    lng: Float
  }

  """
  Error logs for device or tracking issues.
  """
  type ErrorLog {
    timestamp: String
    message: String
  }

  """
  Possible status values for the tracking device.
  """
  enum DeviceStatus {
    ONLINE
    OFFLINE
  }

  """
  Possible conditions for non-digital materials.
  """
  enum MaterialCondition {
    GOOD
    FADED
    DAMAGED
    REMOVED
  }

  """
  Main tracking data for a material.
  """
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

  """
  Input type for GPS coordinates.
  """
  input GPSInput {
    lat: Float
    lng: Float
  }

  """
  Input type for error log entries.
  """
  input ErrorLogInput {
    timestamp: String
    message: String
  }

  """
  Input type for creating/updating material tracking records.
  """
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

  type Query {
    """
    Get a list of all material tracking records (Admin only).
    """
    getMaterialTrackings: [MaterialTracking]

    """
    Get a specific material tracking record by ID (Admin only).
    """
    getMaterialTrackingById(id: ID!): MaterialTracking
  }

  type Mutation {
    """
    Create a new material tracking record (Admin only).
    """
    createMaterialTracking(input: MaterialTrackingInput!): MaterialTracking

    """
    Update an existing material tracking record (Admin only).
    """
    updateMaterialTracking(id: ID!, input: MaterialTrackingInput!): MaterialTracking

    """
    Delete a material tracking record by ID (Admin only).
    """
    deleteMaterialTracking(id: ID!): String
  }
`;

module.exports = typeDefs;
