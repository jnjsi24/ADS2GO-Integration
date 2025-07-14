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

  type Payment {
    id: ID!
    userId: ID!
    adsId: ID!
    paymentType: PaymentType!
    amount: Float!
    receiptId: String!
    paymentStatus: PaymentStatus!
    createdAt: String!
    updatedAt: String!
  }

  input CreatePaymentInput {
    adsId: ID!
    paymentType: PaymentType!
    amount: Float!
    receiptId: String!
  }

  input UpdatePaymentInput {
    paymentStatus: PaymentStatus
  }

  # Wrapper response to include operation success & message
  type PaymentResponse {
    success: Boolean!
    message: String!
    payment: Payment
  }

  type Query {
    # Get all payments for the authenticated user
    getPaymentsByUser: [Payment!]!

    # Get a specific payment by ID (with auth check)
    getPaymentById(id: ID!): Payment
  }

  type Mutation {
    createPayment(input: CreatePaymentInput!): PaymentResponse!
    updatePayment(id: ID!, input: UpdatePaymentInput!): PaymentResponse!
    deletePayment(id: ID!): PaymentResponse!
  }
`;

module.exports = paymentTypeDefs;
