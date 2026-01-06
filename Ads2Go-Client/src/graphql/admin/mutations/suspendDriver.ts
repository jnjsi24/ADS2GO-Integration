import { gql } from '@apollo/client';

export const SUSPEND_DRIVER = gql`
  mutation SuspendDriver($driverId: ID!, $reason: String!) {
    suspendDriver(driverId: $driverId, reason: $reason) {
      success
      message
      driver {
        id
        driverId
        firstName
        middleName
        lastName
        email
        accountStatus
        suspensionReason
      }
    }
  }
`;

