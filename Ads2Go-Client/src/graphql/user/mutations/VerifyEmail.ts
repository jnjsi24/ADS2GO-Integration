import { gql } from '@apollo/client';

export const VERIFY_EMAIL_MUTATION = gql`
  mutation VerifyEmail($code: String!) {
    verifyEmail(code: $code) {
      success
      message
    }
  }
`;

export const RESEND_VERIFICATION_CODE_MUTATION = gql`
  mutation ResendVerificationCode($email: String!) {
    resendVerificationCode(email: $email) {
      success
      message
    }
  }
`;
