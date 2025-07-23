    import { gql } from '@apollo/client';

    export const REGISTER_USER = gql`
    mutation RegisterUser($input: CreateUserInput!) {
        createUser(input: $input) {
        _id
        email
        isEmailVerified
        firstName
        middleName
        lastName
        companyName
        companyAddress
        contactNumber
        houseAddress
        }
    }
    `;
