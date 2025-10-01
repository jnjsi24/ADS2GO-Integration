import { gql } from '@apollo/client';

export const CREATE_FAQ = gql`
  mutation CreateFAQ($input: CreateFAQInput!) {
    createFAQ(input: $input) {
      success
      message
      faq {
        id
        question
        answer
        category
        order
        isActive
        createdAt
        updatedAt
      }
    }
  }
`;

export const UPDATE_FAQ = gql`
  mutation UpdateFAQ($id: ID!, $input: UpdateFAQInput!) {
    updateFAQ(id: $id, input: $input) {
      success
      message
      faq {
        id
        question
        answer
        category
        order
        isActive
        createdAt
        updatedAt
      }
    }
  }
`;

export const DELETE_FAQ = gql`
  mutation DeleteFAQ($id: ID!) {
    deleteFAQ(id: $id) {
      success
      message
    }
  }
`;

export const REORDER_FAQS = gql`
  mutation ReorderFAQs($faqIds: [ID!]!) {
    reorderFAQs(faqIds: $faqIds) {
      success
      message
    }
  }
`;
