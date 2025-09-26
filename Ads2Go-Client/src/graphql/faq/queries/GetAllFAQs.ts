import { gql } from '@apollo/client';

export const GET_ALL_FAQS = gql`
  query GetAllFAQs($filters: FAQFiltersInput) {
    getAllFAQs(filters: $filters) {
      success
      message
      faqs {
        id
        question
        answer
        category
        order
        isActive
        createdAt
        updatedAt
      }
      totalCount
      categoryOrders {
        category
        order
      }
    }
  }
`;

export const GET_FAQ_BY_ID = gql`
  query GetFAQById($id: ID!) {
    getFAQById(id: $id) {
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
