import { Admin } from '../../../graphql/superadmin/queries/sadminAdminQueries';

// Form data interfaces
export interface AdminFormData {
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  companyName: string;
  companyAddress: string;
  contactNumber: string;
  profilePicture?: File | null;
}

export interface EditAdminFormData {
  id: string;
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  contactNumber: string;
  companyName: string;
  companyAddress: string;
  password: string;
  profilePicture: File | null;
}

// Error interfaces
export interface FormErrors {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  companyName?: string;
  companyAddress?: string;
  contactNumber?: string;
  profilePicture?: string;
  general?: string;
}

export interface EditErrors {
  [key: string]: string;
}

// Toast type
export type Toast = {
  id: number;
  message: string;
  type: 'error' | 'success';
};

// Re-export Admin type for convenience
export type { Admin };
