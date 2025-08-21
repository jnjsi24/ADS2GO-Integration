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
      status
      createdAt
      price

      planId {       # populated AdsPlan object
        id
        name
        durationDays
        playsPerDayPerDevice
        numberOfDevices
        adLengthMinutes
        pricePerPlay
        totalPrice
      }

      materialId {   # populated Material object
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
