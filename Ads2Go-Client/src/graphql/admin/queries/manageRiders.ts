import { gql } from '@apollo/client';

export const GET_ALL_DRIVERS = gql`
  query GetAllDrivers {
    getAllDrivers {
      id
      driverId
      firstName
      middleName
      lastName
      email
      contactNumber
      vehicleType
      vehicleModel
      vehiclePlateNumber
      accountStatus
      reviewStatus
      installedMaterialType
      address
      licenseNumber
      licensePictureURL
      orCrPictureURL
      vehiclePhotoURL
      profilePicture
      dateJoined
      approvalDate
      rejectedReason
      createdAt
      lastLogin
      material {
        materialId
        materialType
        category
        description
      }
    }
  }
`;
