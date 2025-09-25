import { gql } from '@apollo/client';
//for admin manageads page
// ===== QUERIES =====

export const GET_ALL_ADS = gql`
  query GetAllAds {
    getAllAds {
      id
      title
      description
      adType
      adFormat
      status
      startTime
      endTime
      mediaFile
      reasonForReject
      approveTime
      rejectTime
      price
      totalPrice
      durationDays
      numberOfDevices
      adLengthSeconds
      playsPerDayPerDevice
      totalPlaysPerDay
      pricePerPlay
      createdAt
      updatedAt
      userId {
        id
        firstName
        lastName
        email
      }
      materialId {
        id
        materialId
      }
      planId {
        id
        durationDays
        numberOfDevices
        adLengthSeconds
        playsPerDayPerDevice
        pricePerPlay
      }
    }
  }
`;

export const GET_AD_BY_ID = gql`
  query GetAdById($id: ID!) {
    getAdById(id: $id) {
      id
      title
      description
      adType
      adFormat
      status
      startTime
      endTime
      mediaFile
      reasonForReject
      approveTime
      rejectTime
      price
      totalPrice
      durationDays
      numberOfDevices
      adLengthSeconds
      playsPerDayPerDevice
      totalPlaysPerDay
      pricePerPlay
      createdAt
      updatedAt
      userId {
        id
        firstName
        lastName
        email
      }
      materialId {
        id
        materialId
      }
      planId {
        id
        durationDays
        numberOfDevices
        adLengthSeconds
        playsPerDayPerDevice
        pricePerPlay
      }
    }
  }
`;

export const GET_ADS_BY_USER = gql`
  query GetAdsByUser($userId: ID!) {
    getAdsByUser(userId: $userId) {
      id
      title
      description
      adType
      adFormat
      status
      startTime
      endTime
      mediaFile
      reasonForReject
      approveTime
      rejectTime
      price
      totalPrice
      durationDays
      numberOfDevices
      adLengthSeconds
      playsPerDayPerDevice
      totalPlaysPerDay
      pricePerPlay
      createdAt
      updatedAt
      userId {
        id
        firstName
        lastName
        email
      }
      materialId {
        id
        materialId
      }
      planId {
        id
        durationDays
        numberOfDevices
        adLengthSeconds
        playsPerDayPerDevice
        pricePerPlay
      }
    }
  }
`;

// ===== MUTATIONS =====

export const CREATE_AD = gql`
  mutation CreateAd($input: CreateAdInput!) {
    createAd(input: $input) {
      id
      title
      description
      adType
      adFormat
      status
      startTime
      endTime
      mediaFile
      price
      totalPrice
      durationDays
      numberOfDevices
      adLengthSeconds
      playsPerDayPerDevice
      totalPlaysPerDay
      pricePerPlay
      createdAt
      updatedAt
      userId {
        id
        firstName
        lastName
        email
      }
      materialId {
        id
        materialId
      }
      planId {
        id
        durationDays
        numberOfDevices
        adLengthSeconds
        playsPerDayPerDevice
        pricePerPlay
      }
    }
  }
`;

export const UPDATE_AD = gql`
  mutation UpdateAd($id: ID!, $input: UpdateAdInput!) {
    updateAd(id: $id, input: $input) {
      id
      status
      reasonForReject
      approveTime
      rejectTime
      startTime
      endTime
      updatedAt
    }
  }
`;

export const DELETE_AD = gql`
  mutation DeleteAd($id: ID!) {
    deleteAd(id: $id)
  }
`;

// ===== DEPLOYMENT QUERIES =====

export const GET_ALL_DEPLOYMENTS = gql`
  query GetAllDeployments {
    getAllDeployments {
      id
      adDeploymentId
      materialId
      driverId
      adId
      lcdSlots {
        id
        adId
        slotNumber
        status
        deployedAt
        completedAt
        removedAt
        removedBy
        removalReason
        mediaFile
        ad {
          id
          title
          description
          adFormat
          mediaFile
        }
      }
      startTime
      endTime
      currentStatus
      lastFrameUpdate
      deployedAt
      completedAt
      removedAt
      removedBy
      removalReason
      createdAt
      updatedAt
      ad {
        id
        title
        description
        adFormat
        mediaFile
        status
      }
      material {
        id
        materialId
        materialType
        vehicleType
      }
      driver {
        id
        driverId
        firstName
        lastName
        email
      }
    }
  }
`;

export const GET_ACTIVE_DEPLOYMENTS = gql`
  query GetActiveDeployments {
    getActiveDeployments {
      id
      adDeploymentId
      materialId
      driverId
      currentStatus
      startTime
      endTime
      deployedAt
      lcdSlots {
        id
        slotNumber
        status
        ad {
          id
          title
          mediaFile
        }
      }
      ad {
        id
        title
        status
      }
      material {
        id
        materialType
        vehicleType
      }
      driver {
        id
        firstName
        lastName
      }
    }
  }
`;

export const GET_DEPLOYMENTS_BY_DRIVER = gql`
  query GetDeploymentsByDriver($driverId: ID!) {
    getDeploymentsByDriver(driverId: $driverId) {
      id
      adDeploymentId
      materialId
      driverId
      currentStatus
      startTime
      endTime
      deployedAt
      lcdSlots {
        id
        slotNumber
        status
        ad {
          id
          title
          mediaFile
        }
      }
      ad {
        id
        title
        status
      }
      material {
        id
        materialType
        vehicleType
      }
    }
  }
`;

// ===== DEPLOYMENT MUTATIONS =====

export const CREATE_DEPLOYMENT = gql`
  mutation CreateDeployment($input: CreateDeploymentInput!) {
    createDeployment(input: $input) {
      id
      adDeploymentId
      materialId
      driverId
      adId
      lcdSlots {
        id
        adId
        slotNumber
        status
        mediaFile
      }
      startTime
      endTime
      currentStatus
      deployedAt
      createdAt
    }
  }
`;

export const UPDATE_DEPLOYMENT_STATUS = gql`
  mutation UpdateDeploymentStatus($id: ID!, $status: DeploymentStatus!) {
    updateDeploymentStatus(id: $id, status: $status) {
      id
      currentStatus
      updatedAt
    }
  }
`;

export const UPDATE_LCD_SLOT_STATUS = gql`
  mutation UpdateLCDSlotStatus($materialId: ID!, $adId: ID!, $status: DeploymentStatus!) {
    updateLCDSlotStatus(materialId: $materialId, adId: $adId, status: $status) {
      id
      lcdSlots {
        id
        slotNumber
        status
        ad {
          id
          title
        }
      }
      currentStatus
      updatedAt
    }
  }
`;

export const REMOVE_ADS_FROM_LCD = gql`
  mutation RemoveAdsFromLCD($materialId: ID!, $adIds: [ID!]!, $reason: String) {
    removeAdsFromLCD(materialId: $materialId, adIds: $adIds, reason: $reason) {
      success
      message
      removedSlots {
        id
        slotNumber
        adId
        status
        removedAt
        removalReason
      }
      availableSlots
    }
  }
`;

export const REASSIGN_LCD_SLOTS = gql`
  mutation ReassignLCDSlots($materialId: ID!) {
    reassignLCDSlots(materialId: $materialId) {
      success
      message
      updates {
        adId
        oldSlot
        newSlot
      }
    }
  }
`;

export const DELETE_DEPLOYMENT = gql`
  mutation DeleteDeployment($id: ID!) {
    deleteDeployment(id: $id)
  }
`;

// ===== TYPES =====

export interface User {
  id: string;
  firstName?: string;
  lastName?: string;
  email: string;
}

export interface Material {
  id: string;
  materialId?: string;
  materialType?: string;
  vehicleType?: string;
}

export interface AdsPlan {
  id: string;
  durationDays: number;
  numberOfDevices: number;
  adLengthSeconds: number;
  playsPerDayPerDevice: number;
  pricePerPlay: number;
}

export interface Ad {
  id: string;
  title: string;
  description: string;
  adType: 'DIGITAL' | 'NON_DIGITAL';
  adFormat: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'RUNNING' | 'ENDED';
  startTime: string;
  endTime: string;
  mediaFile: string;
  reasonForReject?: string;
  approveTime?: string;
  rejectTime?: string;
  price: number;
  totalPrice: number;
  durationDays: number;
  numberOfDevices: number;
  adLengthSeconds: number;
  playsPerDayPerDevice: number;
  totalPlaysPerDay: number;
  pricePerPlay: number;
  createdAt: string;
  updatedAt: string;
  userId: User | null;
  materialId: Material | null;
  planId: AdsPlan | null;
}

export interface LCDSlot {
  id: string;
  adId: string;
  slotNumber: number;
  status: 'SCHEDULED' | 'RUNNING' | 'COMPLETED' | 'PAUSED' | 'CANCELLED' | 'REMOVED';
  deployedAt?: string;
  completedAt?: string;
  removedAt?: string;
  removedBy?: string;
  removalReason?: string;
  mediaFile: string;
  ad?: Ad;
}

export interface AdDeployment {
  id: string;
  adDeploymentId: string;
  materialId: string;
  driverId: string;
  adId?: string;
  lcdSlots: LCDSlot[];
  startTime?: string;
  endTime?: string;
  currentStatus: 'SCHEDULED' | 'RUNNING' | 'COMPLETED' | 'PAUSED' | 'CANCELLED' | 'REMOVED';
  lastFrameUpdate?: string;
  deployedAt?: string;
  completedAt?: string;
  removedAt?: string;
  removedBy?: string;
  removalReason?: string;
  createdAt: string;
  updatedAt: string;
  __v?: number;
  ad?: Ad;
  material?: Material;
  driver?: User;
  removedByUser?: User;
}

export interface CreateAdInput {
  driverId?: string;
  materialId: string;
  planId: string;
  title: string;
  description?: string;
  website?: string;
  adFormat: string;
  mediaFile: string;
  price: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'RUNNING' | 'ENDED';
  startTime: string;
  endTime: string;
  adType: 'DIGITAL' | 'NON_DIGITAL';
}

export interface UpdateAdInput {
  title?: string;
  description?: string;
  adFormat?: string;
  mediaFile?: string;
  materialId?: string;
  planId?: string;
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'RUNNING' | 'ENDED';
  startTime?: string;
  endTime?: string;
  adType?: 'DIGITAL' | 'NON_DIGITAL';
  reasonForReject?: string;
}

export interface CreateDeploymentInput {
  adId: string;
  materialId: string;
  driverId: string;
  startTime?: string;
  endTime?: string;
}
