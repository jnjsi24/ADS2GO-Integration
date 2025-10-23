import { gql } from '@apollo/client';

export const APPROVE_MONTHLY_PHOTO = gql`
  mutation ApproveMonthlyPhoto($materialId: ID!, $month: String!, $adminNotes: String, $condition: MaterialCondition) {
    approveMonthlyPhoto(materialId: $materialId, month: $month, adminNotes: $adminNotes, condition: $condition) {
      success
      message
      materialTracking {
        id
        materialId
        photoComplianceStatus
        lastPhotoUpload
        nextPhotoDue
        materialCondition
        monthlyPhotos { month status photoUrls uploadedAt uploadedBy adminNotes }
      }
    }
  }
`;

export const REJECT_MONTHLY_PHOTO = gql`
  mutation RejectMonthlyPhoto($materialId: ID!, $month: String!, $adminNotes: String) {
    rejectMonthlyPhoto(materialId: $materialId, month: $month, adminNotes: $adminNotes) {
      success
      message
      materialTracking {
        id
        materialId
        photoComplianceStatus
        lastPhotoUpload
        nextPhotoDue
        monthlyPhotos { month status photoUrls uploadedAt uploadedBy adminNotes }
      }
    }
  }
`;


