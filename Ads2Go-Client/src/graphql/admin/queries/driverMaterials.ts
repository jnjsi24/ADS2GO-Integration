import { gql } from '@apollo/client';

export const GET_DRIVER_MATERIALS = gql`
  query GetDriverMaterials($driverId: ID!) {
    getDriverMaterials(driverId: $driverId) {
      success
      message
      materials {
        id
        materialId
        materialType
        materialName
        assignedDate
        mountedAt
        materialTracking {
          photoComplianceStatus
          lastPhotoUpload
          nextPhotoDue
          monthlyPhotos {
            month
            status
            photoUrls
            uploadedAt
            uploadedBy
            adminNotes
          }
        }
      }
    }
  }
`;


