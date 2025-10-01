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
      vehicleType
      createdAt
      price
      startTime
      endTime
      adLengthSeconds

      planId {       # populated AdsPlan object
        id
        name
        durationDays
        playsPerDayPerDevice
        numberOfDevices
        adLengthSeconds
        pricePerPlay
        totalPrice
      }

      materialId {   # populated Material object
        id
        materialId
        materialType
        category
        description
        mountedAt
        dismountedAt
      }

      
    }
  }
`;
