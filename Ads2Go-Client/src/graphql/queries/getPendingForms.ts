import { gql } from '@apollo/client';

export const GET_PENDING_FORMS = gql`
  query GetPendingForms($userId: ID!) {
    getPendingForms(userId: $userId) {
      id
      type
      title
      description
      vehicleType
      material
      plan
      format
      mediaUrl
      name
      email
      contact
      licenseNumber
      plateNumber
      vehicle
      materialsSupported
      materialsId
      areaBase
      licensePicUrl
      orcrPicUrl
      status
    }
  }
`;