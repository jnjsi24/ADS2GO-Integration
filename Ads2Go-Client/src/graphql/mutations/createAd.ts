import { gql } from '@apollo/client';

export const CREATE_AD = gql`
  mutation CreateAd($input: CreateAdInput!) {
    createAd(input: $input) {
      id
      title
      description
      materialId
      planId
      price
      status
      mediaUrl
      startTime
      endTime
      createdAt
      updatedAt
      material {
        id
        type
        name
      }
      plan {
        id
        name
        durationDays
      }
    }
  }
`;
