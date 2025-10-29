import { gql } from '@apollo/client';

export const UPDATE_DRIVER = gql`
  mutation UpdateDriver($driverId: ID!, $input: UpdateDriverInput!) {
    updateDriver(driverId: $driverId, input: $input) {
      success
      message
      driver {
        id
        driverId
        firstName
        middleName
        lastName
        email
        contactNumber
        address
        licenseNumber
        licensePictureURL
        vehiclePlateNumber
        vehicleModel
        vehicleType
        vehicleYear
        vehiclePhotoURL
        orCrPictureURL
        profilePicture
      }
    }
  }
`;

