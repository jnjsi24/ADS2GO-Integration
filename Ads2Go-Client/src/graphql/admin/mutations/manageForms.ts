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

export const APPROVE_DRIVER_APPLICATION = gql`
  mutation ApproveDriverApplication($formId: ID!) {
    approveDriverApplication(formId: $formId) {
      success
      message
    }
  }
`;

export const REJECT_DRIVER_APPLICATION = gql`
  mutation RejectDriverApplication($formId: ID!) {
    rejectDriverApplication(formId: $formId) {
      success
      message
    }
  }
`;