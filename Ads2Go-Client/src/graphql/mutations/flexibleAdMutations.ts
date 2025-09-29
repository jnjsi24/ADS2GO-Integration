import { gql } from '@apollo/client';

export const CREATE_FLEXIBLE_AD = gql`
  mutation CreateFlexibleAd($input: FlexibleAdInput!) {
    createFlexibleAd(input: $input) {
      id
      title
      description
      website
      adType
      adFormat
      price
      durationDays
      numberOfDevices
      adLengthSeconds
      playsPerDayPerDevice
      totalPlaysPerDay
      pricePerPlay
      totalPrice
      status
      adStatus
      paymentStatus
      impressions
      startTime
      endTime
      mediaFile
      userId {
        id
        firstName
        lastName
        email
        companyName
      }
      materialId {
        id
        materialType
        vehicleType
        category
      }
      createdAt
      updatedAt
    }
  }
`;

export interface FlexibleAdInput {
  title: string;
  description: string;
  website?: string;
  materialType: string;
  vehicleType: string;
  category: string;
  durationDays: number;
  adLengthSeconds: number;
  numberOfDevices: number;
  adType: string;
  adFormat: string;
  status: string;
  startTime: string;
  endTime: string;
  mediaFile: string;
}

export interface FlexibleAd {
  id: string;
  title: string;
  description: string;
  website?: string;
  adType: string;
  adFormat: string;
  price: number;
  durationDays: number;
  numberOfDevices: number;
  adLengthSeconds: number;
  playsPerDayPerDevice: number;
  totalPlaysPerDay: number;
  pricePerPlay: number;
  totalPrice: number;
  status: string;
  adStatus: string;
  paymentStatus: string;
  impressions: number;
  startTime: string;
  endTime: string;
  mediaFile: string;
  userId: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    companyName: string;
  };
  materialId: {
    id: string;
    materialType: string;
    vehicleType: string;
    category: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateFlexibleAdResponse {
  createFlexibleAd: FlexibleAd;
}
