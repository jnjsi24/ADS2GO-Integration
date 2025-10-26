const gql = require('graphql-tag');

const companyAdTypeDefs = gql`
  enum CompanyAdFormat {
    VIDEO
    IMAGE
  }

  enum ScheduleType {
    IMMEDIATE
    SCHEDULED
  }

  type CompanyAd {
    id: ID!
    title: String!
    description: String
    mediaFile: String!
    adFormat: CompanyAdFormat!
    duration: Int! # in seconds
    isActive: Boolean!
    priority: Int!
    playCount: Int!
    lastPlayed: String
    createdBy: User!
    updatedBy: User
    tags: [String!]!
    notes: String
    # Scheduling fields
    isScheduled: Boolean!
    startDate: String
    endDate: String
    scheduleType: ScheduleType!
    createdAt: String!
    updatedAt: String!
  }

  input CreateCompanyAdInput {
    title: String!
    description: String
    mediaFile: String!
    adFormat: CompanyAdFormat!
    duration: Int!
    isActive: Boolean
    priority: Int
    tags: [String!]
    notes: String
    # Scheduling fields
    isScheduled: Boolean
    startDate: String
    endDate: String
    scheduleType: ScheduleType
  }

  input UpdateCompanyAdInput {
    title: String
    description: String
    mediaFile: String
    adFormat: CompanyAdFormat
    duration: Int
    isActive: Boolean
    priority: Int
    tags: [String!]
    notes: String
    # Scheduling fields
    isScheduled: Boolean
    startDate: String
    endDate: String
    scheduleType: ScheduleType
  }

  type Query {
    getAllCompanyAds: [CompanyAd!]!
    getCompanyAdById(id: ID!): CompanyAd
    getActiveCompanyAds: [CompanyAd!]!
    getRandomCompanyAd: CompanyAd
  }

  type Mutation {
    createCompanyAd(input: CreateCompanyAdInput!): CompanyAd!
    updateCompanyAd(id: ID!, input: UpdateCompanyAdInput!): CompanyAd!
    deleteCompanyAd(id: ID!): Boolean!
    toggleCompanyAdStatus(id: ID!): CompanyAd!
    incrementCompanyAdPlayCount(id: ID!): CompanyAd!
  }
`;

module.exports = companyAdTypeDefs;
