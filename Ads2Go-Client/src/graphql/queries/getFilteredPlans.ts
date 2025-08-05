// graphql/queries/getFilteredPlans.ts
import { gql } from '@apollo/client';

export const GET_FILTERED_ADS_PLANS = gql`
  query GetAdsPlansByFilter($category: String, $materialType: String, $vehicleType: String) {
    getAdsPlansByFilter(category: $category, materialType: $materialType, vehicleType: $vehicleType) {
      _id
      name
      price
      durationDays
    }
  }
`;
