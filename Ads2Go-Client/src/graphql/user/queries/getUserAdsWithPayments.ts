import { gql } from '@apollo/client';

export const GET_USER_ADS_WITH_PAYMENTS = gql`
  query GetUserAdsWithPayments {
    getUserAdsWithPayments {
      ad {
        id
        title
        mediaFile
        adType
        adFormat
        adLengthSeconds
        totalPrice
        durationDays
        status
        paymentStatus
        createdAt
      }
      payment {
        id
        amount
        paymentStatus
        paymentType
        receiptId
      }
    }
  }
`;

