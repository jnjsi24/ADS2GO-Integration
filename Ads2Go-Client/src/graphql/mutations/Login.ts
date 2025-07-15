    import { gql } from '@apollo/client';

    export const LOGIN_MUTATION = gql`
    mutation Login($email: String!, $password: String!, $deviceInfo: DeviceInfoInput!) {
        login(email: $email, password: $password, deviceInfo: $deviceInfo) {
        token
        user {
            id
            firstName
            lastName
            email
            role
            isEmailVerified
        }
        }
    }
    `;
