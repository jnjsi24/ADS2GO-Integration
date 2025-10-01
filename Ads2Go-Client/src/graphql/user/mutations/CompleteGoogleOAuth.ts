import { gql } from '@apollo/client';

export const COMPLETE_GOOGLE_OAUTH_MUTATION = gql`
  mutation CompleteGoogleOAuthProfile($input: CompleteGoogleOAuthInput!) {
    completeGoogleOAuthProfile(input: $input) {
      token
      user {
        id
        email
        role
        isEmailVerified
        firstName
        middleName
        lastName
        houseAddress
        companyName
        companyAddress
        contactNumber
        profilePicture
        createdAt
        updatedAt
      }
    }
  }
`;
