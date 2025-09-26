import { gql } from '@apollo/client';

export const UPDATE_CATEGORY_ORDER = gql`
  mutation UpdateCategoryOrder($categoryOrders: [CategoryOrderInput!]!) {
    updateCategoryOrder(categoryOrders: $categoryOrders) {
      success
      message
    }
  }
`;
