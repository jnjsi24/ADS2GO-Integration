import { gql } from '@apollo/client';

export const GET_MY_ADS = gql`
  query GetMyAds {
    getMyAds {
      id
      title
      description
      adFormat
      mediaFile
      adType
      vehicleType
      price
      status
      createdAt
      planId {
        id
        name
        durationDays
        playsPerDayPerDevice
        numberOfDevices
        adLengthSeconds
        pricePerPlay
        totalPrice
      }
      materialId {
        id
        materialType
        category
        description
        mountedAt
        dismountedAt
      }
    }
  }
`;
