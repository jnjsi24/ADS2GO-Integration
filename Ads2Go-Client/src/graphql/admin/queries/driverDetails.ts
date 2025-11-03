import { gql } from '@apollo/client';

export const GET_DRIVER_BY_ID = gql`
  query GetDriverById($driverId: ID!) {
    getDriverById(driverId: $driverId) {
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
      licenseFrontURL
      licenseBackURL
      vehiclePlateNumber
      vehicleModel
      vehicleType
      vehicleYear
      vehiclePhotoURL
      orCrPictureURL
      orPictureURL
      crPictureURL
      profilePicture
      accountStatus
      reviewStatus
      createdAt
      lastLogin
    }
  }
`;

