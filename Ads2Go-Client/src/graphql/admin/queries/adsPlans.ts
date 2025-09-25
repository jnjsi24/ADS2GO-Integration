import { gql } from '@apollo/client';

export const GET_ALL_ADS_PLANS = gql`
  query GetAllAdsPlans {
    getAllAdsPlans {
      id
      name
      description
      category
      materialType
      vehicleType
      numberOfDevices
      durationDays
      status
      totalPlaysPerDay
      dailyRevenue
      totalPrice
      adLengthSeconds
      materials {
        id
        materialId
        materialType
        vehicleType
        category
      }
      createdAt
    }
  }
`;

export const GET_FILTERED_ADS_PLANS = gql`
  query GetFilteredAdsPlans(
    $category: String
    $materialType: String
    $vehicleType: String
    $numberOfDevices: Int
    $status: String
  ) {
    getAdsPlansByFilter(
      category: $category
      materialType: $materialType
      vehicleType: $vehicleType
      numberOfDevices: $numberOfDevices
      status: $status
    ) {
      id
      name
      description
      category
      materialType
      vehicleType
      numberOfDevices
      durationDays
      status
      totalPlaysPerDay
      dailyRevenue
      totalPrice
      adLengthSeconds
      createdAt
    }
  }`;
