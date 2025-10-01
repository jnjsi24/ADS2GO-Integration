import { gql } from '@apollo/client';

/**
 * GraphQL Queries for SadminAdmin Component
 * This file contains all queries used in the SadminAdmin dashboard
 */

// Get all admins query
export const GET_ALL_ADMINS = gql`
  query GetAllAdmins {
    getAllAdmins {
      success
      message
      totalCount
      admins {
        id
        firstName
        middleName
        lastName
        email
        role
        isEmailVerified
        companyName
        companyAddress
        contactNumber
        profilePicture
        createdAt
      }
    }
  }
`;

// Type definitions for the queries
export interface Admin {
  id: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  role: 'USER' | 'ADMIN' | 'SUPERADMIN';
  isEmailVerified: boolean;
  companyName?: string;
  companyAddress?: string;
  contactNumber?: string;
  profilePicture?: string;
  createdAt: string | number;
}

export interface GetAllAdminsResponse {
  getAllAdmins: {
    success: boolean;
    message: string;
    totalCount: number;
    admins: Admin[];
  };
}
