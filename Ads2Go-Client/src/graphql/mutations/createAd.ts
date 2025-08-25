import { gql } from '@apollo/client';

export const CREATE_AD = gql`
  mutation CreateAd($input: CreateAdInput!) {
    createAd(input: $input) {
      id
      title
      description
      materialId {
        id
        type
        name
      }
      planId {
        id
        name
        durationDays
      }
      price
      status
      mediaFile
      startTime
      endTime
      createdAt
      updatedAt
    }
  }
`;
