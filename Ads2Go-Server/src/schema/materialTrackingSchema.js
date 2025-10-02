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
  Main compliance data for a device.
  """
  type DeviceCompliance {
    id: ID!
    deviceId: String!
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
  Input type for creating/updating device compliance records.
  """
  input DeviceComplianceInput {
    deviceId: String!
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
    Get a list of all device compliance records (Admin only).
    """
    getDeviceCompliances: [DeviceCompliance]

    """
    Get a specific device compliance record by ID (Admin only).
    """
    getDeviceComplianceById(id: ID!): DeviceCompliance
  }

  type Mutation {
    """
    Create a new device compliance record (Admin only).
    """
    createDeviceCompliance(input: DeviceComplianceInput!): DeviceCompliance

    """
    Update an existing device compliance record (Admin only).
    """
    updateDeviceCompliance(id: ID!, input: DeviceComplianceInput!): DeviceCompliance

    """
    Delete a device compliance record by ID (Admin only).
    """
    deleteDeviceCompliance(id: ID!): String
  }
`;

module.exports = typeDefs;
