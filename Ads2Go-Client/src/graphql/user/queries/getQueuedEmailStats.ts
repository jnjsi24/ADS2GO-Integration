import { gql } from '@apollo/client';

export const GET_QUEUED_EMAIL_STATS = gql`
  query GetQueuedEmailStats {
    getQueuedEmailStats {
      pending
      sent
      failed
      cancelled
    }
  }
`;
