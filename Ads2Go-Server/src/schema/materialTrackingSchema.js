// src/schemas/MaterialTrackingSchema.js
const gql = require('graphql-tag');

const typeDefs = gql`
  """
  Error logs for device or tracking issues.
  """
  type ErrorLog {
    timestamp: String
    message: String
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
    materialId: ID!
    driverId: ID
    materialCondition: MaterialCondition
    inspectionPhotos: [String]
    lastInspectionDate: String
    monthlyPhotos: [MonthlyPhoto]
    lastPhotoUpload: String
    nextPhotoDue: String
    photoComplianceStatus: String
    lastMaintenanceDate: String
    errorLogs: [ErrorLog]
    isActive: Boolean
    metadata: String
    createdAt: String
    updatedAt: String
  }

  """
  Monthly photo tracking for compliance.
  """
  type MonthlyPhoto {
    month: String!
    photoUrls: [String!]!
    uploadedAt: String!
    uploadedBy: String!
    status: String!
    adminNotes: String
    reviewedBy: String
    reviewedAt: String
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
    materialId: ID!
    driverId: ID
    materialCondition: MaterialCondition
    inspectionPhotos: [String]
    lastInspectionDate: String
    lastMaintenanceDate: String
    errorLogs: [ErrorLogInput]
    isActive: Boolean
    metadata: String
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
