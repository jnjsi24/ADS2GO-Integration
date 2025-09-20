import { gql } from '@apollo/client';

/**
 * GraphQL Mutations for SadminAdmin Component
 * This file contains all mutations used in the SadminAdmin dashboard
 */

// Create Admin mutation
export const CREATE_ADMIN = gql`
  mutation CreateAdmin($input: CreateAdminInput!) {
    createAdmin(input: $input) {
      success
      message
      admin {
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

// Update Admin mutation
export const UPDATE_ADMIN = gql`
  mutation UpdateAdmin($adminId: ID!, $input: UpdateAdminInput!) {
    updateAdmin(adminId: $adminId, input: $input) {
      success
      message
      admin {
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

// Delete Admin mutation
export const DELETE_ADMIN = gql`
  mutation DeleteAdmin($id: ID!) {
    deleteAdmin(id: $id) {
      success
      message
      admin {
        id
        firstName
        lastName
        email
      }
    }
  }
`;

// Type definitions for the mutations
export interface CreateAdminInput {
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  password: string;
  companyName: string;
  companyAddress: string;
  contactNumber: string;
  profilePicture?: string;
}

export interface UpdateAdminInput {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  email?: string;
  contactNumber?: string;
  companyName?: string;
  companyAddress?: string;
  password?: string;
  profilePicture?: string;
}

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

export interface CreateAdminResponse {
  createAdmin: {
    success: boolean;
    message: string;
    admin: Admin;
  };
}

export interface UpdateAdminResponse {
  updateAdmin: {
    success: boolean;
    message: string;
    admin: Admin;
  };
}

export interface DeleteAdminResponse {
  deleteAdmin: {
    success: boolean;
    message: string;
    admin: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    };
  };
}
