import { gql } from '@apollo/client';

export const GET_USER_MATERIALS_WITH_LOCATION = gql`
  query GetUserMaterialsWithLocation {
    getUserMaterialsWithLocation {
      success
      message
      activeMaterials
      materials {
        materialId
        materialName
        materialType
        vehicleType
        category
        isOnline
        lastSeen
        currentLocation {
          lat
          lng
          timestamp
          speed
          heading
          accuracy
          address
        }
        totalAdPlays
        totalQRScans
        totalAdPlayTime
        carGroupId
        screenType
        ads {
          adId
          adTitle
          adType
          adFormat
          status
          adStatus
        }
      }
    }
  }
`;

