import { gql } from '@apollo/client';

export const LOGIN_DRIVER = gql`
  mutation LoginDriver($email: String!, $password: String!) {
    loginDriver(email: $email, password: $password) {
      token
      driver {
        _id
        firstName
        lastName
        email
        contactNumber
        accountStatus
      }
    }
  }
`;
