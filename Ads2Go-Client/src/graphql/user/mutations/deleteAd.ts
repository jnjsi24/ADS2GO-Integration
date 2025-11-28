import { gql } from '@apollo/client';

export const DELETE_AD = gql`
  mutation DeleteAd($id: ID!, $reason: String) {
    deleteAd(id: $id, reason: $reason)
  }
`;
