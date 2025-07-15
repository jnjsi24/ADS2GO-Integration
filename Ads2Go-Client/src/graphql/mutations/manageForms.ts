import { gql } from '@apollo/client';

export const APPROVE_AD_FORM = gql`
  mutation ApproveAdForm($formId: ID!) {
    approveAdForm(formId: $formId) {
      success
      message
    }
  }
`;

export const REJECT_AD_FORM = gql`
  mutation RejectAdForm($formId: ID!) {
    rejectAdForm(formId: $formId) {
      success
      message
    }
  }
`;

export const APPROVE_RIDER_APPLICATION = gql`
  mutation ApproveRiderApplication($formId: ID!) {
    approveRiderApplication(formId: $formId) {
      success
      message
    }
  }
`;

export const REJECT_RIDER_APPLICATION = gql`
  mutation RejectRiderApplication($formId: ID!) {
    rejectRiderApplication(formId: $formId) {
      success
      message
    }
  }
`;