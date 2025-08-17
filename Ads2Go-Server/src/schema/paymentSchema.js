



const { gql } = require('graphql-tag');

const paymentTypeDefs = gql`
  enum PaymentStatus {
    PAID
    PENDING
    FAILED
  }

  enum PaymentType {
    CREDIT_CARD
    DEBIT_CARD
    GCASH
    PAYPAL
    BANK_TRANSFER
  }

  type Ad {
    id: ID!
    title: String!
    price: Float!
    name: String!
    durationDays: Int!
    category: String!
    materialType: String!
    vehicleType: String!
    description: String
  }

  type Payment {
    id: ID!
    userId: ID!
    adsId: ID!
    ad: Ad
    planID: ID!
    plan: Ad
    paymentDate: String!
    paymentType: PaymentType!
    amount: Float!
    receiptId: String!
    paymentStatus: PaymentStatus!
    createdAt: String!
    updatedAt: String!
  }

  input CreatePaymentInput {
    adsId: ID!
    paymentDate: String!
    paymentType: PaymentType!
    receiptId: String!
  }

  input UpdatePaymentInput {
    paymentStatus: PaymentStatus!
  }

  type PaymentResponse {
    success: Boolean!
    message: String!
    payment: Payment
  }

  type Query {
    getPaymentsByUser: [Payment!]!
    getAllPayments: [Payment!]!
    getPaymentById(id: ID!): Payment
  }

  type Mutation {
    createPayment(input: CreatePaymentInput!): PaymentResponse!
    updatePayment(id: ID!, input: UpdatePaymentInput!): PaymentResponse!
    deletePayment(id: ID!): PaymentResponse!
  }
`;

module.exports = paymentTypeDefs;



