const { gql } = require('apollo-server-express');

const faqSchema = gql`
  enum FAQCategory {
    ADVERTISERS
    DRIVERS
    EVERYONE
  }

  type FAQ {
    id: ID!
    question: String!
    answer: String!
    category: FAQCategory!
    order: Int!
    isActive: Boolean!
    createdAt: String!
    updatedAt: String!
  }

  type FAQCategoryOrder {
    category: FAQCategory!
    order: Int!
  }

  input CreateFAQInput {
    question: String!
    answer: String!
    category: FAQCategory!
    order: Int
    isActive: Boolean
  }

  input UpdateFAQInput {
    question: String
    answer: String
    category: FAQCategory
    order: Int
    isActive: Boolean
  }

  input FAQFiltersInput {
    category: FAQCategory
    isActive: Boolean
  }

  input CategoryOrderInput {
    category: FAQCategory!
    order: Int!
  }

  type FAQResponse {
    success: Boolean!
    message: String!
    faq: FAQ
  }

  type FixOrdersResponse {
    success: Boolean!
    message: String!
    fixedCount: Int!
  }

  type FAQsResponse {
    success: Boolean!
    message: String!
    faqs: [FAQ!]!
    totalCount: Int!
    categoryOrders: [FAQCategoryOrder!]
  }

  extend type Query {
    getAllFAQs(filters: FAQFiltersInput): FAQsResponse!
    getFAQById(id: ID!): FAQResponse!
  }

  extend type Mutation {
    createFAQ(input: CreateFAQInput!): FAQResponse!
    updateFAQ(id: ID!, input: UpdateFAQInput!): FAQResponse!
    deleteFAQ(id: ID!): FAQResponse!
    reorderFAQs(faqIds: [ID!]!): FAQResponse!
    fixFAQOrders(category: FAQCategory!): FixOrdersResponse!
    fixAllFAQOrders: FixOrdersResponse!
    updateCategoryOrder(categoryOrders: [CategoryOrderInput!]!): FAQResponse!
  }
`;

module.exports = faqSchema;
