const gql = require('graphql-tag');

const typeDefs = gql`
  # Enums
  enum TabletStatus {
    ONLINE
    OFFLINE
    PLAYING
    IDLE
    MAINTENANCE
  }

  enum PlaybackStatus {
    PLAYING
    PAUSED
    COMPLETED
    ERROR
  }

  enum NotificationType {
    INFO
    WARNING
    ERROR
    SUCCESS
  }

  # Types
  type Tablet {
    id: ID!
    tabletId: String!
    name: String
    status: TabletStatus!
    location: Location
    currentAd: String
    currentAdName: String
    batteryLevel: Int
    lastSeen: String
    createdAt: String
    updatedAt: String
  }

  type Location {
    latitude: Float!
    longitude: Float!
    address: String
    timestamp: String
  }

  type Playback {
    id: ID!
    tabletId: String!
    adId: String!
    adName: String!
    startTime: String!
    endTime: String
    status: PlaybackStatus!
    location: Location
    impressions: Int!
    duration: Int
  }

  type Notification {
    id: ID!
    tabletId: String!
    title: String!
    message: String!
    type: NotificationType!
    data: JSON
    timestamp: String!
    read: Boolean!
    readAt: String
  }

  type DashboardData {
    tablets: [Tablet!]!
    tracking: [Location!]!
    playback: [Playback!]!
    summary: DashboardSummary!
  }

  type DashboardSummary {
    totalTablets: Int!
    onlineTablets: Int!
    playingTablets: Int!
    offlineTablets: Int!
  }

  type SyncStatus {
    isRunning: Boolean!
    syncInterval: Int!
    lastSync: String
  }

  # Inputs
  input RegisterTabletInput {
    tabletId: String!
    name: String
    location: LocationInput
  }

  input LocationInput {
    latitude: Float!
    longitude: Float!
    address: String
  }

  input UpdateTabletStatusInput {
    status: TabletStatus!
    location: LocationInput
    batteryLevel: Int
    currentAd: String
    currentAdName: String
  }

  input StartPlaybackInput {
    tabletId: String!
    adId: String!
    adName: String!
    location: LocationInput
  }

  input UpdatePlaybackInput {
    impressions: Int
    status: PlaybackStatus
  }

  input EndPlaybackInput {
    duration: Int!
    impressions: Int!
  }

  input SendNotificationInput {
    tabletId: String!
    title: String!
    message: String!
    type: NotificationType
    data: JSON
  }

  # Queries
  type Query {
    # Tablet queries
    getAllTablets: [Tablet!]!
    getTabletStatus(tabletId: String!): Tablet
    getTabletLocation(tabletId: String!): Location
    
    # Playback queries
    getCurrentPlayback(tabletId: String!): Playback
    getActivePlaybacks: [Playback!]!
    
    # Notification queries
    getUnreadNotifications(tabletId: String!): [Notification!]!
    
    # Dashboard queries
    getDashboardData: DashboardData!
    
    # Sync queries
    getSyncStatus: SyncStatus!
  }

  # Mutations
  type Mutation {
    # Tablet management
    registerTablet(input: RegisterTabletInput!): Tablet!
    updateTabletStatus(tabletId: String!, input: UpdateTabletStatusInput!): Tablet!
    updateTabletLocation(tabletId: String!, location: LocationInput!): Location!
    
    # Playback management
    startPlayback(input: StartPlaybackInput!): Playback!
    updatePlayback(playbackId: String!, input: UpdatePlaybackInput!): Playback!
    endPlayback(playbackId: String!, input: EndPlaybackInput!): Playback!
    
    # Notification management
    sendNotification(input: SendNotificationInput!): Notification!
    markNotificationAsRead(notificationId: String!): Notification!
    
    # Sync management
    startSync: SyncStatus!
    stopSync: SyncStatus!
    setSyncInterval(interval: Int!): SyncStatus!
    manualSync(tabletId: String!): Boolean!
  }

  # Subscriptions
  type Subscription {
    tabletStatusChanged(tabletId: String!): Tablet!
    locationChanged(tabletId: String!): Location!
    playbackChanged(tabletId: String!): Playback!
    notificationReceived(tabletId: String!): Notification!
    dashboardUpdated: DashboardData!
  }

  # Scalar for JSON data
  scalar JSON
`;

module.exports = typeDefs;
