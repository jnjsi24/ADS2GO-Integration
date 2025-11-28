import { gql } from '@apollo/client';

export const APPROVE_DRIVER = gql`
  mutation ApproveDriver($driverId: ID!, $materialTypeOverride: [MaterialTypeEnum!]) {
    approveDriver(driverId: $driverId, materialTypeOverride: $materialTypeOverride) {
      success
      message
      driver {
        id
        driverId
        accountStatus
        reviewStatus
        installedMaterialType
      }
    }
  }
`;

export const REJECT_DRIVER = gql`
  mutation RejectDriver($driverId: ID!, $reason: String!) {
    rejectDriver(driverId: $driverId, reason: $reason) {
      success
      message
      driver {
        id
        driverId
        accountStatus
        reviewStatus
        rejectedReason
      }
    }
  }
`;

export const DELETE_DRIVER = gql`
  mutation DeleteDriver($driverId: ID!, $reason: String) {
    deleteDriver(driverId: $driverId, reason: $reason) {
      success
      message
    }
  }
`;

export const RESTORE_DRIVER = gql`
  mutation RestoreDriver($driverId: ID!) {
    restoreDriver(driverId: $driverId) {
      success
      message
    }
  }
`;
