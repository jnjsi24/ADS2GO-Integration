// src/types/admin.types.ts
// Shared type definitions for Admin-related components

export type UserRole = 'USER' | 'ADMIN' | 'SUPERADMIN';

export interface Admin {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  isEmailVerified: boolean;
  companyName?: string;
  companyAddress?: string;
  houseAddress?: string;
  contactNumber?: string;
  profilePicture?: string;
  createdAt: string; // ISO date string format (e.g., "2025-08-08T12:00:00Z")
  updatedAt?: string; // optional timestamp for last update
}

export interface Toast {
  id: number;
  message: string;
  type: 'error' | 'success' | 'info';
}
