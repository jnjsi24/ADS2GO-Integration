import { gql } from '@apollo/client';

export const DELETE_AD = gql`
  mutation DeleteAd($id: ID!) {
    deleteAd(id: $id)
  }
`;
